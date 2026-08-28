const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { GoogleGenAI } = require("@google/genai");

initializeApp();
const db = getFirestore();

// Helper to delay execution (exponential backoff)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GEMINI_API_KEYS_POOL = process.env.GEMINI_API_KEYS
  ? process.env.GEMINI_API_KEYS.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean)
  : [];

let currentKeyIndex = 0;

function getNextApiKey(studentApiKey) {
  if (studentApiKey && studentApiKey.trim()) {
    return studentApiKey.trim();
  }
  if (GEMINI_API_KEYS_POOL.length === 0) {
    return process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
  }
  // Round robin
  const key = GEMINI_API_KEYS_POOL[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS_POOL.length;
  return key;
}

function getGoogleGenAI(studentApiKey) {
  const apiKey = getNextApiKey(studentApiKey);
  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY trên hệ thống.");
  }
  return new GoogleGenAI({ apiKey });
}

async function runOCR(studentApiKey, base64Image, imageType) {
  const match = base64Image.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
  if (!match) return "";
  const mimeType = match[1];
  const base64Data = match[2].trim();

  let prompt = "";
  if (imageType === "teacher_solution") {
    prompt = `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC nội dung đáp án trong hình ảnh.
Nhiệm vụ: Chuyển đổi hình ảnh đáp án của giáo viên thành văn bản.

YÊU CẦU CỰC KỲ QUAN TRỌNG VỀ ĐIỂM SỐ:
- Quan sát kỹ bên lề hoặc cạnh các bước giải xem có số điểm không (ví dụ: 0.25, 0.5đ, 1.0, 0,25).
- Nếu thấy điểm số, hãy ghi rõ ngay tại dòng đó theo định dạng: [Điểm: 0.25].
- Ví dụ: "Ta có: x = 2 [Điểm: 0.25]"

YÊU CẦU QUAN TRỌNG:
- Đọc từng dòng, từng ký tự một cách chính xác tuyệt đối
- Giữ nguyên format, layout, thứ tự các bước giải
- Ghi rõ từng bước giải và điểm số tương ứng nếu có
- Sử dụng LaTeX cho công thức toán: $x^2 + 1 = 0$
- Nếu có biểu đồ, hình vẽ: mô tả chi tiết
- Nếu có chú thích, ghi chú: ghi lại chính xác
- Nếu chữ viết tay khó đọc: [KHÔNG RÕ: ...]

YÊU CỰC KỲ QUAN TRỌNG VỀ ĐIỂM SỐ:
- Quan sát kỹ bên lề hoặc cột điểm hoặc chú thích dưới các bài giải hoặc cạnh các bước giải xem có số điểm không (ví dụ: 0.25, 0.5đ, 1.0, 0,25).
- Nếu thấy điểm số, hãy ghi rõ ngay tại dòng đó theo định dạng: [Điểm: 0.25]. Nếu chỉ có 1 điểm tổng cho nhiều dòng thì tự chia điểm cho từng dòng.
- Ví dụ: "Ta có: x = 2 [Điểm: 0.25]"

ĐỊNH DẠNG ĐẦU RA:
[BƯỚC 1] Nội dung bước 1. [Điểm: ...]
[BƯỚC 2] Nội dung bước 2. [Điểm: ...]
...
[KẾT QUẢ] Đáp án cuối cùng. [Điểm: ...]

Chỉ trả về nội dung OCR, không giải thích thêm.`;
  } else if (imageType === "student_work") {
    prompt = `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC bài làm học sinh trong hình ảnh.

YÊU CẦU QUAN TRỌNG:
- Đọc từng dòng, từng bước làm chính xác tuyệt đối
- Giữ nguyên thứ tự các bước làm của học sinh
- Ghi lại cả những chỗ làm sai, làm thiếu
- Sử dụng LaTeX cho công thức: $x^2 - 5x + 6 = 0$
- Nếu có tẩy xóa, sửa chữa: ghi chú [SỬA: ...]
- Nếu có vẽ hình, biểu đồ: mô tả chi tiết
- Nếu chữ viết tay khó đọc: [KHÔNG ĐỌC ĐƯỢC: khu vực này]

ĐỊNH DẠNG ĐẦU RA:
Bước 1: Nội dung bước 1
Bước 2: Nội dung bước 2
...
Kết luận: Đáp án của học sinh

Chỉ trả về nội dung OCR, không nhận xét.`;
  } else {
    prompt = `Hãy đọc và gõ lại chính xác nội dung văn bản/toán học trong hình ảnh.
- Sử dụng LaTeX cho công thức toán, bọc trong dấu $
- Giữ nguyên format và cấu trúc
- Nếu có ký hiệu đặc biệt, gõ chính xác
Chỉ trả về nội dung đã OCR.`;
  }

  let attempt = 0;
  let currentApiKeyToUse = studentApiKey;
  const poolSize = GEMINI_API_KEYS_POOL.length;
  const maxAttempts = (currentApiKeyToUse ? 3 : 0) + (poolSize > 0 ? poolSize : 3);

  while (attempt < maxAttempts) {
    try {
      const ai = getGoogleGenAI(currentApiKeyToUse);
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      });
      return response.text ? response.text.trim() : "";
    } catch (e) {
      attempt++;
      console.error(`[Cloud Function OCR] Lỗi lần thử ${attempt}/${maxAttempts}:`, e.message || e);
      if (attempt >= maxAttempts) throw e;

      const hasSystemFallback = GEMINI_API_KEYS_POOL.length > 0 || !!process.env.GEMINI_API_KEY;
      const isPermanentAuthError = 
        e.status === 'PERMISSION_DENIED' || 
        e.status === 403 || 
        (e.message && (
          e.message.includes('API key not valid') || 
          e.message.includes('API_KEY_INVALID') || 
          e.message.includes('invalid key') ||
          e.message.includes('PERMISSION_DENIED')
        ));

      const isQuotaError = 
        e.status === 'RESOURCE_EXHAUSTED' || 
        e.status === 429 || 
        (e.message && (
          e.message.includes('exhausted') || 
          e.message.includes('quota') || 
          e.message.includes('limit') || 
          e.message.includes('RESOURCE_EXHAUSTED') ||
          e.message.includes('429')
        ));

      if (currentApiKeyToUse && hasSystemFallback && (isPermanentAuthError || isQuotaError)) {
        console.warn(`[OCR Fallback] Chuyển tiếp sang System API Key.`);
        currentApiKeyToUse = undefined;
        continue;
      }

      await sleep(Math.pow(2, attempt) * 200);
    }
  }
  return "";
}

function extractScoreFromText(text) {
  if (!text) return 0;
  const patterns = [
    /ĐIỂM\s*TỔNG\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[\/\s]*10/i,
    /ĐIỂM\s*SỐ\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /TỔNG\s*ĐIỂM\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /Điểm\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /Score\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*\/\s*10/i,
    /(\d+(?:[.,]\d+)?)\s*điểm/i
  ];

  let score = 0;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      score = parseFloat((match[1] || match[0]).replace(',', '.'));
      break;
    }
  }

  if (!score) {
    const jsonMatch = text.match(/"score"\s*:\s*(\d+(?:[.,]\d+)?)/i);
    if (jsonMatch) score = parseFloat(jsonMatch[1].replace(',', '.'));
  }

  if (isNaN(score)) score = 0;
  if (score < 0) score = 0;
  if (score > 10) score = 10;
  
  return Math.round(score * 4) / 4; // Round to nearest 0.25
}

exports.gradeEssayTrigger = onDocumentWritten({
  document: "essay_submissions/{submissionId}",
  timeoutSeconds: 540, // 9 minutes execution boundary
  memory: "1GiB"
}, async (event) => {
  const submissionId = event.params.submissionId;
  const snapshot = event.data;

  if (!snapshot.after.exists) {
    console.log(`Submission document ${submissionId} was deleted.`);
    return null;
  }

  const data = snapshot.after.data();
  const beforeData = snapshot.before.exists ? snapshot.before.data() : null;

  // Only run grading if status is requested
  if (data.status !== "submitted" && data.status !== "grading") {
    return null;
  }

  // Guard against recursion
  if (beforeData && (beforeData.status === "grading_in_progress" || beforeData.status === "graded")) {
    if (data.status === beforeData.status) {
      return null;
    }
  }

  console.log(`[Cloud Function] Starting async grading trigger for ${submissionId}`);

  const docRef = db.collection("essay_submissions").doc(submissionId);
  await docRef.update({
    status: "grading_in_progress",
    errorMsg: null
  });

  try {
    const studentApiKey = data.studentApiKey;

    // Fetch original essay assignment
    const essaySnap = await db.collection("essays").doc(data.essayId).get();
    if (!essaySnap.exists) {
      throw new Error("Không tìm thấy đề bài tự luận tương ứng.");
    }
    const essay = essaySnap.data();

    // 1. Chuẩn bị đề bài
    let problemText = `Tiêu đề: ${essay.title}\nMô tả: ${essay.description || "Không có mô tả"}\n`;
    if (essay.assignmentOcrText) {
      problemText += "\nNội dung đề bài từ văn bản:\n" + essay.assignmentOcrText;
    } else {
      problemText += "\nNội dung đề bài: (Xem trực tiếp và phân tích từ hình ảnh đính kèm đề bài nếu có)\n";
    }

    // 2. Chuẩn bị đáp án chuẩn của giáo viên
    let teacherSolutions = essay.solutionText || "";
    if (!teacherSolutions) {
      teacherSolutions = "Chưa cung cấp văn bản đáp án chuẩn. (Xem trực tiếp từ hình ảnh đáp án đính kèm nếu có, hoặc tự giải chi tiết theo đề bài)";
    }

    // 3. Chuẩn bị bài làm học sinh (nội dung text tự nhập nếu có)
    let studentAnswerText = data.text || "";

    // 4. Tiến hành chấm điểm chi tiết bằng prompt giáo viên toán học chuyên nghiệp (Multimodal)
    console.log("[Cloud Function] Tiến hành chấm điểm so sánh trực tiếp đa phương tiện (Multimodal)...");
    const gradingPrompt = `Bạn là GIÁO VIÊN TOÁN HỌC CHUYÊN NGHIỆP với 20 năm kinh nghiệm chấm bài.
Nhiệm vụ: CHẤM BÀI TOÁN bằng cách đọc và phân tích trực tiếp hình ảnh bài làm học sinh, đối chiếu chi tiết với đề bài và đáp án chuẩn.

[ĐỀ BÀI]
${problemText}

[ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN]
${teacherSolutions}

${studentAnswerText ? `[BÀI LÀM CỦA HỌC SINH (Văn bản)]: \n${studentAnswerText}` : "[BÀI LÀM CỦA HỌC SINH]: Xem chi tiết nét chữ viết tay và các bước giải trực tiếp từ các hình ảnh bài làm đính kèm bên dưới."}

TIÊU CHÍ CHẤM BÀI:
1. PHƯƠNG PHÁP GIẢI: Chọn đúng phương pháp/chủ đề (ví dụ: đặt ẩn phụ, đạo hàm, BĐT Cauchy, quy nạp, đổi biến, tách phân thức, v.v.).
2. CÁC BƯỚC THỰC HIỆN: Lập luận chặt chẽ, biến đổi hợp lệ, không nhảy bước quan trọng; chỉ ra và định danh lỗi (khái niệm, đại số, biến đổi, điều kiện xác định, đơn vị).
3. KẾT QUẢ CUỐI CÙNG: Đáp án đúng/đủ điều kiện, dạng rút gọn/chuẩn (nếu yêu cầu), kèm đơn vị (nếu có).

QUY TẮC CHẤM:
- Nếu sai phương pháp: không tính điểm
- Nếu phương pháp đúng nhưng có lỗi tính toán nhỏ làm sai đáp án trong bước đó: không tính điểm phần đó và các bước sau dựa trên kết quả sai
- Nếu làm đúng phương pháp và kết quả đúng, có thể gộp/bỏ qua vài bước mà không ảnh hưởng: cho điểm tối đa
- Nếu thiếu bước quan trọng: trừ điểm ngay cả khi kết quả cuối cùng đúng
- Nếu làm đúng một phần: cho điểm tương ứng theo biểu điểm
- Nếu có cách làm sáng tạo và đúng: cho điểm tối đa
- Thang điểm: 0–10 (cho phép dùng 0.25, 0.5, 0.75). Làm tròn điểm cuối cùng đến bội số 0.25

HÃY TRẢ VỀ ĐÚNG ĐỊNH DẠNG SAU (sử dụng Markdown cho đẹp mắt):

### CHI TIẾT CHẤM:
- **Câu 1**: [Điểm đạt được] / [Điểm tối đa câu]. 
  - *Lỗi (nếu có)*: [Chỉ ghi ngắn gọn lỗi sai. Ví dụ: "Sai dấu dòng 3", "Thiếu điều kiện x>0". Nếu đúng ghi "Làm tốt"].
  - *Thiếu (nếu có)*: [Mô tả bước quan trọng bị thiếu].
- **Câu 2**: [Điểm đạt được] / [Điểm tối đa câu].
  - ... (tương tự)

### TỔNG ĐIỂM: [Số điểm] / 10. (Không làm tròn)

### NHẬN XÉT & GÓP Ý:
- **Ưu điểm**: [Nhận xét điểm tốt, khen ngợi những chỗ học sinh làm đúng và sáng tạo]
- **Nhược điểm**: [Phân tích chi tiết những lỗi sai, lỗ hổng kiến thức học sinh mắc phải]
- **Khắc phục**: [Đưa ra hướng dẫn cụ thể cách sửa lỗi và gợi ý ôn tập]

QUY TẮC TRÌNH BÀY CÔNG THỨC TOÁN HỌC:
- KHÔNG sử dụng các đoạn mã LaTeX thô hoặc phức tạp (như \\frac, \\sqrt, \\alpha, \\beta, \\Rightarrow, v.v.).
- Thay vào đó, hãy viết công thức toán học một cách trực quan, đẹp mắt và dễ hiểu bằng các ký tự unicode toán học thông thường (ví dụ: dùng x², y³, √x, π, ±, ≥, ≤, ≠, dấu chia / hoặc phân số dạng a/b, v.v.). Học sinh và giáo viên cần đọc được ngay trực tiếp mà không cần hệ thống biên dịch mã LaTeX.

LƯU Ý CUỐI:
- KHÔNG liệt kê lại các bước làm đúng.
- KHÔNG cần cung cấp đáp án chuẩn hay giải chi tiết của đề bài trong phần đánh giá này.
- Tập trung vào việc chỉ ra lỗi sai để học sinh sửa.`;

    // 5. Thiết lập mảng parts cho cuộc gọi Multimodal duy nhất
    const promptParts = [];
    promptParts.push({ text: gradingPrompt });

    // Đính kèm ảnh đề bài nếu đề bài gốc chưa được chuyển đổi thành văn bản
    if (!essay.assignmentOcrText && essay.assignmentImages && essay.assignmentImages.length > 0) {
      promptParts.push({ text: "\n\n--- HÌNH ẢNH ĐỀ BÀI (HÃY ĐỌC ĐỀ BÀI TỪ CÁC HÌNH DƯỚI ĐÂY) ---" });
      essay.assignmentImages.forEach((img, idx) => {
        const match = img.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
        if (match) {
          promptParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2].trim()
            }
          });
        }
      });
    }

    // Đính kèm ảnh đáp án của giáo viên nếu chưa có văn bản giải thích chi tiết
    if (!essay.solutionText && essay.solutionImages && essay.solutionImages.length > 0) {
      promptParts.push({ text: "\n\n--- HÌNH ẢNH ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (HÃY THAM KHẢO) ---" });
      essay.solutionImages.forEach((img, idx) => {
        const match = img.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
        if (match) {
          promptParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2].trim()
            }
          });
        }
      });
    }

    // Đính kèm ảnh bài làm của học sinh
    if (data.images && data.images.length > 0) {
      promptParts.push({ text: "\n\n--- HÌNH ẢNH BÀI LÀM CỦA HỌC SINH (HÃY PHÂN TÍCH VÀ CHẤM ĐIỂM CHÍNH XÁC NÉT CHỮ VIẾT TAY TRÊN ẢNH DƯỚI ĐÂY) ---" });
      data.images.forEach((img, idx) => {
        const match = img.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
        if (match) {
          promptParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2].trim()
            }
          });
        }
      });
    }

    let response = null;
    let attempt = 0;
    let currentApiKeyToUse = studentApiKey;
    const poolSize = GEMINI_API_KEYS_POOL.length;
    const maxRetries = (currentApiKeyToUse ? 1 : 0) + (poolSize > 0 ? 1 : 2);

    while (attempt < maxRetries) {
      try {
        const ai = getGoogleGenAI(currentApiKeyToUse);
        response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: { parts: promptParts }
        });
        break;
      } catch (apiErr) {
        attempt++;
        console.error(`[Cloud Function AI Grading] Lỗi lần thử ${attempt}/${maxRetries}:`, apiErr.message || apiErr);
        if (attempt >= maxRetries) throw apiErr;

        const hasSystemFallback = GEMINI_API_KEYS_POOL.length > 0 || !!process.env.GEMINI_API_KEY;
        const isPermanentAuthError = 
          apiErr.status === 'PERMISSION_DENIED' || 
          apiErr.status === 403 || 
          (apiErr.message && (
            apiErr.message.includes('API key not valid') || 
            apiErr.message.includes('API_KEY_INVALID') || 
            apiErr.message.includes('invalid key') ||
            apiErr.message.includes('PERMISSION_DENIED')
          ));

        const isQuotaError = 
          apiErr.status === 'RESOURCE_EXHAUSTED' || 
          apiErr.status === 429 || 
          (apiErr.message && (
            apiErr.message.includes('exhausted') || 
            apiErr.message.includes('quota') || 
            apiErr.message.includes('limit') || 
            apiErr.message.includes('RESOURCE_EXHAUSTED') ||
            apiErr.message.includes('429')
          ));

        if (currentApiKeyToUse && hasSystemFallback && (isPermanentAuthError || isQuotaError)) {
          console.warn(`[AI Grading Fallback] Chuyển tiếp sang System API Key.`);
          currentApiKeyToUse = undefined;
          continue;
        }

        await sleep(Math.pow(2, attempt) * 500);
      }
    }

    if (!response || !response.text) {
      throw new Error("AI không trả về kết quả chấm điểm.");
    }

    const aiFeedback = response.text;
    const score = extractScoreFromText(aiFeedback);

    console.log(`[Cloud Function] Chấm điểm thành công cho ${submissionId}. Điểm số: ${score}/10`);

    // Write results back to submission
    await docRef.update({
      aiFeedback,
      score,
      status: "graded",
      errorMsg: null
    });

    // Sync score back to Student completedEssays array in user profile
    const studentId = data.studentId;
    const userRef = db.collection("users").doc(studentId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userDoc = userSnap.data();
      const completedEssays = userDoc.completedEssays || [];
      const updatedEssays = completedEssays.map(item => {
        if (item.submissionId === submissionId) {
          return {
            ...item,
            score,
            status: "graded"
          };
        }
        return item;
      });
      await userRef.update({ completedEssays: updatedEssays });
    }

  } catch (err) {
    console.error(`[Cloud Function ERROR] Chấm điểm thất bại cho ${submissionId}:`, err);
    
    let errorStatus = "grading_failed";
    let finalErrorMsg = err.message || "Lỗi bất ngờ xảy ra trong quá trình chấm điểm.";

    const lowerMsg = finalErrorMsg.toLowerCase();
    const isKeyErr = 
      lowerMsg.includes('quota') || 
      lowerMsg.includes('exhausted') || 
      lowerMsg.includes('api_key_invalid') ||
      lowerMsg.includes('api key not valid') ||
      lowerMsg.includes('api key is invalid') ||
      lowerMsg.includes('invalid api key') ||
      lowerMsg.includes('permission_denied') ||
      lowerMsg.includes('permission denied') ||
      lowerMsg.includes('rate limit') ||
      lowerMsg.includes('limit exceeded');

    if (isKeyErr) {
      errorStatus = "key_error";
      finalErrorMsg = `API Key gặp sự cố hoặc hết lượt sử dụng. Chi tiết: ${err.message}.`;
    }

    await docRef.update({
      status: errorStatus,
      errorMsg: finalErrorMsg
    });

    // Also sync error status to student's user profile
    const studentId = data.studentId;
    const userRef = db.collection("users").doc(studentId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userDoc = userSnap.data();
      const completedEssays = userDoc.completedEssays || [];
      const updatedEssays = completedEssays.map(item => {
        if (item.submissionId === submissionId) {
          return {
            ...item,
            status: errorStatus
          };
        }
        return item;
      });
      await userRef.update({ completedEssays: updatedEssays });
    }
  }

  return null;
});
