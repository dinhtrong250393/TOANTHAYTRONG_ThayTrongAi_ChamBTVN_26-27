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
  app.post("/api/solve-textbook-exercise", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "No image provided." });

      const prompt = `Bạn là một giáo viên Toán học xuất sắc. Hình ảnh tôi cung cấp là một phần cắt từ Sách giáo khoa hoặc Sách bài tập, chứa MỘT BÀI TẬP DUY NHẤT. Hãy đọc, giải chi tiết và chia barem điểm cho bài tập này (tổng 10 điểm).

BẮT BUỘC TRẢ VỀ JSON HỢP LỆ THEO ĐÚNG ĐỊNH DẠNG SAU, KHÔNG THÊM BẤT KỲ VĂN BẢN NÀO BÊN NGOÀI:
{
  "title": "Tên bài tập (VD: Bài 1, Câu 2...)",
  "questionText": "Nội dung câu hỏi...",
  "solutionText": "Nội dung bài giải chi tiết, từng bước rõ ràng. Đi kèm mỗi bước là số điểm của bước đó, ví dụ: [Điểm: 0.25]. TỔNG ĐIỂM CÁC BƯỚC PHẢI LÀ 10.0."
}`;

      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      const matchData = imageBase64.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
      if (matchData) {
        mimeType = matchData[1];
        base64Data = matchData[2].trim();
      }

      let ai = getGoogleGenAI(getNextApiKey());
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } }
        ],
        config: {
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
          ]
        }
      });
      
      let text = response.text || "";
      let parsed = null;
      try {
        let cleanText = text.replace(/\x60\x60\x60json/gi, "").replace(/\x60\x60\x60/g, "").trim();
        parsed = JSON.parse(cleanText);
      } catch (parseErr) {
        console.warn("Could not parse JSON. Falling back to raw text. Text was:", text);
        parsed = {
           title: "Bài tập AI",
           questionText: "Vui lòng xem hình ảnh",
           solutionText: text
        };
      }
      res.json(parsed);
    } catch (err: any) {
      console.error("[API Solve Textbook ERROR]:", err);
      res.status(500).json({ error: err.message || "Lỗi giải bài SGK" });
    }
  });

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
          await new Promise(r => setTimeout(r, 1200));
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

  app.post("/api/grade-essay", async (req, res) => {
    try {
      const { essay, submission, studentApiKey } = req.body;
      if (!essay || !submission) {
        return res.status(400).json({ error: "Thiếu thông tin bài kiểm tra hoặc bài làm." });
      }

      const gradingPrompt = `Bạn là một giáo viên chấm thi xuất sắc. Nhiệm vụ của bạn là chấm điểm bài làm tự luận của học sinh dựa trên đề bài và đáp án chuẩn (hoặc barem điểm) của giáo viên đưa ra.

HÃY THỰC HIỆN CÁC BƯỚC SAU ĐỂ CHẤM ĐIỂM:
1. **Phân tích đề bài và Barem điểm**: Xem xét kỹ nội dung đề bài (hình ảnh hoặc văn bản) và đáp án của giáo viên (hình ảnh hoặc văn bản). Nắm bắt chuẩn xác số điểm phân bổ cho từng bước (ví dụ: [Điểm: 0.25]). TỔNG ĐIỂM LUÔN LÀ 10. Nếu không có barem, hãy tự phân bổ 10 điểm hợp lý theo độ khó từng câu/bước.
2. **Đối chiếu Bài làm**: Đọc kỹ hình ảnh bài làm của học sinh, chú ý từng chi tiết nhỏ, nét chữ viết tay, sự logic trong cách trình bày.
3. **Đánh giá Chi tiết**: Đối chiếu từng phần của bài làm với đáp án. Ghi chú rõ: học sinh làm đúng bước nào (được cộng bao nhiêu điểm), làm sai/thiếu bước nào (bị trừ/không được bao nhiêu điểm).
4. **Tổng kết Điểm**: Cần có mục tổng kết điểm rõ ràng bằng cụm từ chính xác: "TỔNG ĐIỂM: [Số điểm] / 10" (Ví dụ: TỔNG ĐIỂM: 8.5 / 10). TỐI ĐA LÀ 10 ĐIỂM, LÀM TRÒN ĐẾN 0.25 (ví dụ: 8.0, 8.25, 8.5, 8.75).

ĐỊNH DẠNG TRẢ VỀ (RẤT QUAN TRỌNG):
**1. Phân tích bài làm**
- Câu 1 / Bước 1: [Nhận xét...] => [Điểm đạt được]
- Câu 2 / Bước 2: [Nhận xét...] => [Điểm đạt được]
...

**2. Lời khuyên cho học sinh**
- [Gợi ý cách khắc phục lỗi hoặc lời khen ngợi]

**3. TỔNG ĐIỂM: [Số điểm] / 10**

QUY TẮC TOÁN HỌC: Trình bày công thức toán học một cách trực quan bằng unicode (VD: x², √x, phân số a/b), KHÔNG dùng LaTeX thô (như \\frac).`;

      const promptParts = [];
      promptParts.push({ text: gradingPrompt });

      if (essay.questionText) { promptParts.push({ text: "\n\n--- NỘI DUNG ĐỀ BÀI (VĂN BẢN) ---\n" + essay.questionText }); }
      if (essay.solutionText) { promptParts.push({ text: "\n\n--- ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (CÓ BAREM ĐIỂM) ---\n" + essay.solutionText }); }

      // Helper to fetch base64 from image URL or passthrough data URI
      const fetchImageAsBase64Part = async (imgStr) => {
        let mimeType = 'image/jpeg';
        let base64Data = '';
        if (imgStr.startsWith('http')) {
          try {
            const response = await fetch(imgStr);
            const arrayBuffer = await response.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');
            mimeType = response.headers.get('content-type') || 'image/jpeg';
          } catch (e) { console.error('Error fetching image URL:', e); return null; }
        } else {
          const m = imgStr.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
          if (m) { mimeType = m[1]; base64Data = m[2].trim(); }
        }
        if (base64Data) return { inlineData: { mimeType, data: base64Data } };
        return null;
      };

      if (!essay.questionText && essay.assignmentImages && essay.assignmentImages.length > 0) {
        promptParts.push({ text: "\n\n--- HÌNH ẢNH ĐỀ BÀI (HÃY ĐỌC ĐỀ BÀI TỪ CÁC HÌNH DƯỚI ĐÂY) ---" });
        for (const img of essay.assignmentImages) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      if (!essay.solutionText && essay.solutionImages && essay.solutionImages.length > 0) {
        promptParts.push({ text: "\n\n--- HÌNH ẢNH ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (HÃY THAM KHẢO) ---" });
        for (const img of essay.solutionImages) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      if (submission.images && submission.images.length > 0) {
        promptParts.push({ text: "\n\n--- HÌNH ẢNH BÀI LÀM CỦA HỌC SINH (HÃY PHÂN TÍCH VÀ CHẤM ĐIỂM CHÍNH XÁC NÉT CHỮ VIẾT TAY TRÊN ẢNH DƯỚI ĐÂY) ---" });
        for (const img of submission.images) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      let ai = getGoogleGenAI(getNextApiKey(studentApiKey));
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: promptParts
      });

      const aiFeedback = response.text || "";
      const score = extractScoreFromText(aiFeedback);
      res.json({ aiFeedback, score });
    } catch (err) {
      console.error("[AI Grading Pipeline ERROR]:", err);
      res.status(500).json({ error: err.message || "Lỗi khi chấm điểm AI tự luận" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const path = await import("path");
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
