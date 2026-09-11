import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const GEMINI_API_KEYS_POOL: string[] = process.env.GEMINI_API_KEYS
    ? process.env.GEMINI_API_KEYS.split(/[,;\s]+/).map(k => k.trim()).filter(Boolean)
    : [];
  let currentKeyIndex = 0;

  function getNextApiKey(studentApiKey?: string): string {
    if (studentApiKey?.trim()) {
      return studentApiKey.trim();
    }
    if (GEMINI_API_KEYS_POOL.length === 0) {
      return process.env.GEMINI_API_KEY?.trim() || "";
    }
    const key = GEMINI_API_KEYS_POOL[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS_POOL.length;
    return key;
  }

  function getGoogleGenAI(apiKey: string) {
    if (!apiKey) throw new Error("Missing Gemini API Key");
    return new GoogleGenAI({ apiKey });
  }

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/solve-textbook-exercise", async (req, res) => {
    try {
      const { imageBase64, studentApiKey } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      const matchData = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,([\s\S]+)$/);
      if (matchData) {
        mimeType = matchData[1];
        base64Data = matchData[2].trim();
      }

      const prompt = `Bạn là một chuyên gia giáo dục. Hãy phân tích hình ảnh và trả về JSON hợp lệ theo định dạng:
{
  "title": "Tên bài",
  "questionText": "Đề bài",
  "solutionText": "Lời giải chi tiết"
}`;

      const ai = getGoogleGenAI(getNextApiKey(studentApiKey));
      let text = "";
      let jsonResult;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Data } }
            ],
            config: {
              responseMimeType: "application/json"
            }
          });
          text = response.text || "";
          const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (match) text = match[1];
          text = text.trim();
          // Sanitize text for common LaTeX unescaped backslashes before parsing
          let sanitizedText = text.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
          try {
            jsonResult = JSON.parse(sanitizedText);
          } catch (parseErr) {
            jsonResult = JSON.parse(text);
          }
          break;
        } catch (e: any) {
          if (attempt === 2) throw new Error("Lỗi gọi AI: " + (e.message || e) + (text ? (" | Output: " + text) : ""));
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      res.json(jsonResult);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to solve" });
    }
  });

  app.post("/api/grade-essay", async (req, res) => {
    try {
      const { submission, essay, studentApiKey } = req.body;
      const ai = getGoogleGenAI(getNextApiKey(studentApiKey));
      
      const prompt = `Bạn là một giáo viên chấm thi tự luận.
Dưới đây là một bài làm tự luận của học sinh (đã được đính kèm dưới dạng hình ảnh) cùng với Đề bài và Lời giải mẫu (đáp án chuẩn).

Nhiệm vụ của bạn:
1. Đọc và nhận diện chữ viết tay/công thức toán học từ hình ảnh bài làm.
2. Cảnh báo nếu hình ảnh quá mờ, không thể đọc được.
3. Đối chiếu từng bước giải quyết trong bài làm của học sinh với lời giải chuẩn.
4. NẾU học sinh giải quyết bài toán theo một cách KHÁC biệt so với đáp án chuẩn NHƯNG logic vẫn đúng và ra kết quả đúng, HÃY CÔNG NHẬN CÁCH LÀM ĐÓ và cho điểm tối đa cho phần đó.
5. Đưa ra nhận xét chi tiết, công tâm: chỉ ra điểm đúng, điểm sai, lỗi tư duy hoặc lỗi tính toán (nếu có), và gọi ý cách khắc phục.
6. KIỂM TRA KỸ THANG ĐIỂM (BAREM): Bạn BẮT BUỘC phải bám sát thang điểm (barem) của từng ý, từng câu được ghi trong Đề bài hoặc Lời giải chuẩn. 
   - NẾU câu A được giao 5.0 điểm, BẠN CHỈ ĐƯỢC CHẤM TỐI ĐA 5.0 ĐIỂM cho câu A (không được chấm 4.0 hay 6.0).
   - Cộng tổng điểm đạt được một cách chính xác và lô-gic nhất (từ 0 đến 10, có thể lẻ đến 0.25).

LƯU Ý QUAN TRỌNG VỀ JSON: NẾU TRONG NHẬN XÉT CÓ SỬ DỤNG CÔNG THỨC TOÁN HỌC LATEX (VD: \infty, \geq), BẠN PHẢI ESCAPE DẤU BACKSLASH THÀNH 2 DẤU (VD: \\infty, \\geq) ĐỂ ĐẢM BẢO CHUỖI JSON HỢP LỆ.

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON TUYỆT ĐỐI THEO ĐỊNH DẠNG SAU:
{
  "score": <điểm số là một số, ví dụ 8.5>,
  "aiFeedback": "<nhận xét chi tiết của bạn>"
}

--- Thông tin bài toán ---
Đề bài:
${essay.questionText || 'Không có văn bản đề bài'}

Lời giải chuẩn:
${essay.solutionText || 'Không có lời giải chuẩn, hãy tự giải và chấm theo tư duy logic.'}`;

      const contents = [];
      contents.push({ text: prompt });

      // Process images
      if (submission.images && submission.images.length > 0) {
        // We will dynamically import sharp if available, else just fetch
        let sharp;
        try {
          sharp = require('sharp');
        } catch (e) {
          console.warn('sharp not available, skipping image compression');
        }

        for (const imgUrl of submission.images) {
          try {
            const imgRes = await fetch(imgUrl);
            const arrayBuffer = await imgRes.arrayBuffer();
            let buffer = Buffer.from(arrayBuffer);
            let mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

            if (sharp) {
              // Compress and resize
              buffer = await sharp(buffer)
                .resize({ width: 1500, withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
              mimeType = 'image/jpeg';
            }

            contents.push({
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: mimeType
              }
            });
          } catch (imgErr) {
            console.error('Error processing image:', imgUrl, imgErr);
          }
        }
      } else {
        // Fallback to OCR text if no images (legacy support)
        contents.push({ text: "Bài làm của học sinh (đã OCR từ ảnh):\n" + (submission.submissionImages?.join('\n') || '') });
      }

      let text = "";
      let jsonResult;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: contents,
            config: {
              responseMimeType: "application/json"
            }
          });
          text = response.text || "";
          const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (match) text = match[1];
          text = text.trim();
          // Sanitize text for common LaTeX unescaped backslashes before parsing
          let sanitizedText = text.replace(/\\([^"\\/bfnrtu])/g, '\\\\$1');
          try {
            jsonResult = JSON.parse(sanitizedText);
          } catch (parseErr) {
            jsonResult = JSON.parse(text);
          }
          break;
        } catch (e: any) {
          if (attempt === 2) throw new Error("Lỗi gọi AI: " + (e.message || e) + (text ? (" | Output: " + text) : ""));
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      res.json(jsonResult);
    } catch (error: any) {
      console.error(error);
      if (error.message && (error.message.includes("429") || error.message.includes("Resource Exhausted") || error.message.includes("Quota"))) {
        res.status(429).json({ error: error.message || "Quá giới hạn API. Vui lòng thử lại sau." });
      } else {
        res.status(500).json({ error: error.message || "Failed to grade" });
      }
    }
  });

  
  app.post("/api/ocr-images", async (req, res) => {
    try {
      const { images, prompt, studentApiKey } = req.body;
      if (!images || !images.length) return res.status(400).json({ error: "No images provided" });

      const ai = getGoogleGenAI(getNextApiKey(studentApiKey));
      const contents: any[] = [];
      if (prompt) contents.push({ text: prompt });
      else contents.push({ text: "Vui lòng đọc và trích xuất toàn bộ chữ/công thức từ các ảnh này." });

      for (const imgBase64 of images) {
        let mimeType = "image/jpeg";
        let base64Data = imgBase64;
        const matchData = imgBase64.match(/^data:(image\/[a-zA-Z]+);base64,([\s\S]+)$/);
        if (matchData) {
          mimeType = matchData[1];
          base64Data = matchData[2].trim();
        }
        contents.push({ inlineData: { mimeType, data: base64Data } });
      }

      let text = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents,
          });
          text = response.text || "";
          break;
        } catch (e: any) {
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      res.json({ success: true, text });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to OCR" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
