const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const ocrApi = `
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
        const matchData = imgBase64.match(/^data:(image\\/[a-zA-Z]+);base64,([\\s\\S]+)$/);
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

      res.json({ text: response.text || "" });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to OCR" });
    }
  });
`;

code = code.replace('if (process.env.NODE_ENV !== "production")', ocrApi + '\n  if (process.env.NODE_ENV !== "production")');
fs.writeFileSync('server.ts', code);
