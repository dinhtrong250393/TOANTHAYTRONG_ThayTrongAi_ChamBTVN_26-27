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
      let text = response.text || "";
      if (text.startsWith("\`\`\`json")) {
        text = text.replace(/^\`\`\`json/m, "").replace(/\`\`\`$/m, "").trim();
      }
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to solve" });
    }
  });

  app.post("/api/grade-essay", async (req, res) => {
    try {
      const { submission, essay, studentApiKey } = req.body;
      const ai = getGoogleGenAI(getNextApiKey(studentApiKey));
      
      const prompt = `Bạn là giáo viên chấm thi. Hãy chấm bài làm tự luận sau dựa vào lời giải. Trả về JSON:
{
  "score": điểm số từ 0 đến 10,
  "aiFeedback": "Nhận xét chi tiết"
}
Đề bài: ${essay.questionText}
Lời giải đúng: ${essay.solutionText}
Bài làm của học sinh (đã OCR từ ảnh):
${submission.submissionImages?.join('\n') || ''}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let text = response.text || "";
      if (text.startsWith("\`\`\`json")) {
        text = text.replace(/^\`\`\`json/m, "").replace(/\`\`\`$/m, "").trim();
      }
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to grade" });
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

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
      });

      res.json({ success: true, text: response.text || "" });
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
