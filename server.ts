import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ override: true });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GEMINI_API_KEYS_POOL: string[] = process.env.GEMINI_API_KEYS
  ? process.env.GEMINI_API_KEYS.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean)
  : [];

console.log(`[System Pool] Khởi tạo pool với ${GEMINI_API_KEYS_POOL.length} API Keys từ biến môi trường GEMINI_API_KEYS.`);

let currentKeyIndex = 0;
const keysCooldown = new Map<string, number>();

function getNextApiKey(studentApiKey?: string): string {
  if (studentApiKey?.trim()) {
    return studentApiKey.trim();
  }
  if (GEMINI_API_KEYS_POOL.length === 0) {
    return process.env.GEMINI_API_KEY?.trim() || "";
  }
  
  const now = Date.now();
  let selectedKey = "";
  let checkedCount = 0;
  
  while (checkedCount < GEMINI_API_KEYS_POOL.length) {
    const key = GEMINI_API_KEYS_POOL[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS_POOL.length;
    
    const cooldownUntil = keysCooldown.get(key) || 0;
    if (now > cooldownUntil) {
      selectedKey = key;
      break;
    }
    checkedCount++;
  }
  
  if (!selectedKey) {
    selectedKey = GEMINI_API_KEYS_POOL[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS_POOL.length;
    console.log(`[API Key Rotator] Tất cả các keys đều đang cooldown. Sử dụng tạm index ${currentKeyIndex}`);
  } else {
    console.log(`[API Key Rotator] Chọn key hợp lệ tại index ${(currentKeyIndex - 1 + GEMINI_API_KEYS_POOL.length) % GEMINI_API_KEYS_POOL.length}`);
  }
  
  return selectedKey;
}

function getGoogleGenAI(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY trên hệ thống.");
  }
  return new GoogleGenAI({ apiKey });
}

async function fetchWithTimeout(url: string, options = {}, timeout = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large images
  app.use(express.json({ limit: '50mb' }));

  // OCR Helper Function
  async function runOCR(studentApiKey: string | undefined, base64Image: string, imageType: 'teacher_solution' | 'student_work' | 'general'): Promise<string> {
    let mimeType = '';
    let base64Data = '';
    if (base64Image.startsWith('http')) {
      try {
        const response = await fetchWithTimeout(base64Image);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64Data = buffer.toString('base64');
        mimeType = response.headers.get('content-type') || 'image/jpeg';
      } catch (e) {
        console.error('Error fetching image URL:', e);
        return "";
      }
    } else {
      const matchData = base64Image.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
      if (!matchData) return "";
      mimeType = matchData[1];
      base64Data = matchData[2].trim();
    }


    let prompt = "";
    // ... (prompt definition remains the same)
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
    let currentApiKeyToUse = studentApiKey?.trim();
    const poolSize = GEMINI_API_KEYS_POOL.length;
    // Limit to 10 total attempts to avoid infinite hang or socket storm
    const maxAttempts = Math.min(10, (currentApiKeyToUse ? 3 : 0) + (poolSize > 0 ? poolSize : 5));
    
    while (attempt < maxAttempts) {
      const resolvedKey = currentApiKeyToUse || getNextApiKey(undefined);
      try {
        const ai = getGoogleGenAI(resolvedKey);
        const modelName = 'gemini-3.6-flash';
        const responsePromise = ai.models.generateContent({
          model: modelName,
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
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Thời gian kết nối AI nhận diện ảnh quá hạn (timeout 45s).")), 45000)
        );
        const response = await Promise.race([responsePromise, timeoutPromise]);
        return response.text?.trim() || "";
      } catch (e: any) {
        attempt++;
        console.error(`[OCR] Lỗi lần thử ${attempt}/${maxAttempts} (Key: ${currentApiKeyToUse ? "Custom" : "System Pool"}):`, e.message || e);
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
          
        const isOverloadedError = e.status === 503 || e.status === 'UNAVAILABLE' || (e.message && e.message.includes('high demand'));

        // Put failing key on cooldown
        if (resolvedKey) {
          if (isPermanentAuthError) {
            console.warn(`[OCR Key Cooldown] API Key lỗi auth. Đặt cooldown 1 giờ cho key: ${resolvedKey.substring(0, 8)}...`);
            keysCooldown.set(resolvedKey, Date.now() + 3600000); // 1 hour
          } else if (isQuotaError) {
            console.warn(`[OCR Key Cooldown] API Key hết Quota. Đặt cooldown 1 phút cho key: ${resolvedKey.substring(0, 8)}...`);
            keysCooldown.set(resolvedKey, Date.now() + 60000); // 1 minute
          }
        }

        if (currentApiKeyToUse && hasSystemFallback && (isPermanentAuthError || isQuotaError)) {
          console.warn(`[OCR Fallback] API Key học sinh gặp sự cố (${e.message || "Quota/Auth Error"}). Tự động chuyển hướng dự phòng sang Pool API Key hệ thống! Chuyển ngay lập tức không thử lại.`);
          currentApiKeyToUse = undefined; // Trigger system pool on subsequent attempts
          await new Promise(r => setTimeout(r, 400)); // small delay before fallback
          continue; // Immediately try next key from pool
        }
        
        if (!currentApiKeyToUse && (isPermanentAuthError || isQuotaError)) {
          if (poolSize > 1) {
            await new Promise(r => setTimeout(r, 400)); // brief wait to prevent rate-limit socket floods
            continue; // immediately try the next key from the pool
          }
        }
        
        let backoffTime = Math.pow(2, attempt) * 500;
        if (isQuotaError) {
          backoffTime = 8000; // wait 8s if all keys exhausted
        } else if (isOverloadedError) {
          backoffTime = 3000;
        }
        await new Promise(r => setTimeout(r, backoffTime));
      }
    }
    return "";
  }

  function extractScoreFromText(text: string): number {
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

  // API route for converting images to math text/formulas using OCR
  app.post("/api/ocr-images", async (req, res) => {
    try {
      const { images, type, studentApiKey } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Không tìm thấy hình ảnh để nhận diện." });
      }

      console.log(`[API OCR] Nhận diện ${images.length} ảnh dạng ${type || 'general'}...`);
      
      const ocrResults: string[] = [];
      for (let i = 0; i < images.length; i++) {
        if (i > 0) {
          console.log(`[API OCR] Đang nghỉ 1.2s trước ảnh thứ ${i + 1}...`);
          await sleep(1200);
        }
        const text = await runOCR(studentApiKey, images[i], type || 'general');
        ocrResults.push(text);
      }

      const combinedText = ocrResults.filter(Boolean).join("\n\n---\n\n");
      res.json({ success: true, text: combinedText });
    } catch (err: any) {
      console.error("[API OCR ERROR]:", err);
      res.status(500).json({ error: err.message || "Lỗi khi nhận diện hình ảnh toán học" });
    }
  });

  // API route for AI grading
  
async function fetchImageAsBase64Part(imgStr: string) {
  if (imgStr.startsWith('http')) {
    try {
      const response = await fetchWithTimeout(imgStr);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      return {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      };
    } catch (e) {
      console.error('Error fetching image URL for grading:', e);
      return null;
    }
  } else {
    const match = imgStr.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
    if (match) {
      return {
        inlineData: {
          mimeType: match[1],
          data: match[2].trim()
        }
      };
    }
  }
  return null;
}
  app.post("/api/grade-essay", async (req, res) => {
    try {
      const { submission, essay, studentApiKey } = req.body;
      if (!submission || !essay) {
        return res.status(400).json({ error: "Thiếu dữ liệu bài làm hoặc đề bài." });
      }

      console.log(`[AI Grading Pipeline] Bắt đầu chấm bài "${essay.title}"...`);

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
      let studentAnswerText = submission.text || "";

      // 4. Tiến hành chấm điểm chi tiết bằng prompt giáo viên toán học chuyên nghiệp (Multimodal)
      console.log("[AI Grading Pipeline] Tiến hành chấm điểm so sánh trực tiếp đa phương tiện (Multimodal)...");
      const gradingPrompt = `Bạn là GIÁO VIÊN TOÁN HỌC CHUYÊN NGHIỆP với 20 năm kinh nghiệm chấm bài.
Nhiệm vụ: CHẤM BÀI TOÁN bằng cách đọc và phân tích trực tiếp hình ảnh bài làm học sinh, đối chiếu chi tiết với đề bài và đáp án chuẩn.

[ĐỀ BÀI]
\${problemText}

[ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (KÈM BIỂU ĐIỂM)]
\${teacherSolutions}

\${studentAnswerText ? \`[BÀI LÀM CỦA HỌC SINH (Văn bản)]: \\n\${studentAnswerText}\` : "[BÀI LÀM CỦA HỌC SINH]: Xem chi tiết nét chữ viết tay và các bước giải trực tiếp từ các hình ảnh bài làm đính kèm bên dưới."}

TIÊU CHÍ CHẤM BÀI KHẮT KHE & CHÍNH XÁC:
1. SỬ DỤNG ĐÚNG THANG ĐIỂM TỪNG CÂU: Hãy TÌM, ĐỌC KỸ và TUÂN THỦ NGHIÊM NGẶT điểm số tối đa của từng câu/từng phần đã được ghi chú trong "ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN". Tuyệt đối không tự ý phân bổ điểm (Ví dụ: Nếu đáp án ghi Câu 1: (5 điểm), Câu 2: (5 điểm) thì điểm tối đa Câu 1 là 5, Câu 2 là 5).
2. LINH HOẠT VỀ PHƯƠNG PHÁP: Học sinh có thể giải bằng nhiều phương pháp, cách thức trình bày, hay thứ tự các bước khác với đáp án chuẩn. Nếu phương pháp đó đúng về mặt toán học và dẫn đến kết quả chính xác, hãy CHO ĐIỂM TỐI ĐA phần đó. Không trừ điểm nếu cách trình bày khác biệt nhưng vẫn logic và đầy đủ ý.
3. CÁC BƯỚC THỰC HIỆN: Lập luận chặt chẽ, biến đổi hợp lệ. Hãy theo dõi kỹ từng bước tính toán.
4. KẾT QUẢ CUỐI CÙNG: Đáp án đúng/đủ điều kiện, dạng rút gọn/chuẩn (nếu yêu cầu), kèm đơn vị (nếu có).

QUY TẮC TRỪ ĐIỂM (CHỈ ÁP DỤNG KHI LÀM SAI):
- Nếu sai phương pháp: không tính điểm.
- Nếu sai tính toán từ một bước giữa chừng: Không tính điểm phần đó và các bước sau dựa trên kết quả sai (trừ khi các phần sau độc lập).
- Nếu thiếu điều kiện hoặc thiếu kết luận nhưng các bước giải đúng: Trừ điểm nhỏ (ví dụ 0.25 - 0.5 điểm) dựa trên tổng điểm.
- Chỉ trừ điểm khi có lỗi sai thực sự về toán học, KHÔNG trừ điểm vì trình bày không giống hệt đáp án.
- Tổng điểm đạt được của từng câu KHÔNG ĐƯỢT VƯỢT QUÁ số điểm tối đa quy định của câu đó.
- Thang điểm tổng: 10. Chấm điểm chi tiết (cho phép lẻ 0.25, 0.5).

HÃY TRẢ VỀ ĐÚNG ĐỊNH DẠNG SAU (sử dụng Markdown cho đẹp mắt):

### CHI TIẾT CHẤM:
- **Câu [Số câu]**: [Điểm đạt được] / [Điểm tối đa câu theo đáp án chuẩn]. 
  - *Lỗi (nếu có)*: [Chỉ ghi ngắn gọn lỗi sai thực sự. Ví dụ: "Sai dấu dòng 3", "Thiếu điều kiện x>0". Nếu đúng hoàn toàn ghi "Làm tốt"].
  - *Thiếu (nếu có)*: [Mô tả bước quan trọng bị thiếu. Nếu không ghi "Không có"].
- **Câu [Số câu tiếp theo]**: ... (tương tự)

### TỔNG ĐIỂM: [Số điểm] / 10. (Không làm tròn)

### NHẬN XÉT & GÓP Ý:
- **Ưu điểm**: [Nhận xét điểm tốt, khen ngợi phương pháp làm sáng tạo hoặc kết quả chính xác]
- **Nhược điểm**: [Phân tích chi tiết những lỗi sai, lỗ hổng kiến thức học sinh mắc phải]
- **Khắc phục**: [Đưa ra hướng dẫn cụ thể cách sửa lỗi và gợi ý ôn tập]

QUY TẮC TRÌNH BÀY CÔNG THỨC TOÁN HỌC:
- KHÔNG sử dụng các đoạn mã LaTeX thô hoặc phức tạp (như \\frac, \\sqrt, \\alpha, \\beta, \\Rightarrow, v.v.).
- Thay vào đó, hãy viết công thức toán học một cách trực quan, đẹp mắt và dễ hiểu bằng các ký tự unicode toán học thông thường (ví dụ: dùng x², y³, √x, π, ±, ≥, ≤, ≠, dấu chia / hoặc phân số dạng a/b, v.v.). Học sinh và giáo viên cần đọc được ngay trực tiếp mà không cần hệ thống biên dịch mã LaTeX.

LƯU Ý CUỐI:
- HÃY ĐẢM BẢO BẠN SỬ DỤNG ĐÚNG ĐIỂM TỐI ĐA CHO TỪNG CÂU TỪ ĐÁP ÁN.
- Tôn trọng các cách giải đúng khác nhau của học sinh.
- KHÔNG liệt kê lại các bước làm đúng.
- KHÔNG cần cung cấp đáp án chuẩn hay giải chi tiết của đề bài trong phần đánh giá này.
- Tập trung vào việc chỉ ra lỗi sai để học sinh sửa.`;

      // 5. Thiết lập mảng parts cho cuộc gọi Multimodal duy nhất
      const promptParts = [];
      promptParts.push({ text: gradingPrompt });

      // Đính kèm ảnh đề bài nếu đề bài gốc chưa được chuyển đổi thành văn bản
      if (!essay.assignmentOcrText && essay.assignmentImages && essay.assignmentImages.length > 0) {
        promptParts.push({ text: "\n\n--- HÌNH ẢNH ĐỀ BÀI (HÃY ĐỌC ĐỀ BÀI TỪ CÁC HÌNH DƯỚI ĐÂY) ---" });
        for (const img of essay.assignmentImages) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      // Đính kèm ảnh đáp án của giáo viên nếu chưa có văn bản giải thích chi tiết
      if (!essay.solutionText && essay.solutionImages && essay.solutionImages.length > 0) {
        promptParts.push({ text: "\n\n--- HÌNH ẢNH ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (HÃY THAM KHẢO) ---" });
        for (const img of essay.solutionImages) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      // Đính kèm ảnh bài làm của học sinh
      if (submission.images && submission.images.length > 0) {
        promptParts.push({ text: "\n\n--- HÌNH ẢNH BÀI LÀM CỦA HỌC SINH (HÃY PHÂN TÍCH VÀ CHẤM ĐIỂM CHÍNH XÁC NÉT CHỮ VIẾT TAY TRÊN ẢNH DƯỚI ĐÂY) ---" });
        for (const img of submission.images) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      let response: any = null;
      let attempt = 0;
      let currentApiKeyToUse = studentApiKey?.trim();
      const poolSize = GEMINI_API_KEYS_POOL.length;
      // Limit to 10 total attempts to avoid infinite hang or socket storm
      const maxRetries = Math.min(10, (currentApiKeyToUse ? 3 : 0) + (poolSize > 0 ? poolSize : 5));
      
      while (attempt < maxRetries) {
        const resolvedKey = currentApiKeyToUse || getNextApiKey(undefined);
        try {
          const ai = getGoogleGenAI(resolvedKey);
          const modelName = 'gemini-3.6-flash';
          const responsePromise = ai.models.generateContent({
            model: modelName,
            contents: promptParts
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Thời gian kết nối AI chấm điểm quá hạn (timeout 45s).")), 45000)
          );
          response = await Promise.race([responsePromise, timeoutPromise]);
          break;
        } catch (apiErr: any) {
          attempt++;
          console.error(`[AI Grading] Chấm điểm lần ${attempt}/${maxRetries} thất bại (Key: ${currentApiKeyToUse ? "Custom" : "System Pool"}):`, apiErr.message || apiErr);
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
          
          const isOverloadedError = apiErr.status === 503 || apiErr.status === 'UNAVAILABLE' || (apiErr.message && apiErr.message.includes('high demand'));

          // Put failing key on cooldown
          if (resolvedKey) {
            if (isPermanentAuthError) {
              console.warn(`[AI Grading Key Cooldown] API Key lỗi auth. Đặt cooldown 1 giờ cho key: ${resolvedKey.substring(0, 8)}...`);
              keysCooldown.set(resolvedKey, Date.now() + 3600000); // 1 hour
            } else if (isQuotaError) {
              console.warn(`[AI Grading Key Cooldown] API Key hết Quota. Đặt cooldown 1 phút cho key: ${resolvedKey.substring(0, 8)}...`);
              keysCooldown.set(resolvedKey, Date.now() + 60000); // 1 minute
            }
          }

          if (currentApiKeyToUse && hasSystemFallback && (isPermanentAuthError || isQuotaError)) {
            console.warn(`[AI Grading Fallback] API Key học sinh gặp sự cố (${apiErr.message || "Quota/Auth Error"}). Tự động chuyển hướng dự phòng sang Pool API Key hệ thống! Chuyển ngay lập tức không thử lại.`);
            currentApiKeyToUse = undefined; // Trigger system pool on subsequent attempts
            await new Promise(r => setTimeout(r, 400)); // small delay before fallback
            continue; // Immediately try next key from pool
          }
          
          if (!currentApiKeyToUse && (isPermanentAuthError || isQuotaError)) {
            if (poolSize > 1) {
              await new Promise(r => setTimeout(r, 400)); // brief wait to prevent rate-limit socket floods
              continue; // immediately try the next key from the pool
            }
          }
          
          let backoffTime = Math.pow(2, attempt) * 1000;
          if (isQuotaError) {
             console.warn(`[AI Grading Quota] Quota exceeded. Waiting 8s before retry...`);
             backoffTime = 8000; // wait 8 seconds for quota reset
          } else if (isOverloadedError) {
             console.warn(`[AI Grading Overload] API Overloaded. Waiting 3s before retry...`);
             backoffTime = 3000; // wait 3 seconds
          }
          await new Promise(r => setTimeout(r, backoffTime));
        }
      }

      if (!response || !response.text) {
        throw new Error("AI không trả về kết quả chấm điểm.");
      }

      const aiFeedback = response.text;
      const score = extractScoreFromText(aiFeedback);

      console.log(`[AI Grading Pipeline] Chấm điểm thành công. Điểm số: ${score}/10`);
      res.json({ aiFeedback, score });
    } catch (err: any) {
      console.error("[AI Grading Pipeline ERROR]:", err);
      res.status(500).json({ error: err.message || "Lỗi khi chấm điểm AI tự luận" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
