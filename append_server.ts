  app.post("/api/solve-textbook-exercise", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "No image provided." });

      const prompt = `Bạn là một giáo viên Toán học xuất sắc. Hình ảnh tôi cung cấp là một phần cắt từ Sách giáo khoa hoặc Sách bài tập, chứa MỘT BÀI TẬP DUY NHẤT. Hãy đọc, giải chi tiết và chia barem điểm cho bài tập này (tổng 10 điểm).

Trình bày theo định dạng JSON sau:
{
  "title": "Tên bài tập (VD: Bài 1, Câu 2...)",
  "questionText": "Nội dung câu hỏi (ghi lại đầy đủ đề bài, dùng ký hiệu unicode toán học thông thường, KHÔNG dùng LaTeX)",
  "solutionText": "Nội dung bài giải chi tiết, từng bước rõ ràng. Đi kèm mỗi bước là số điểm của bước đó, ví dụ: [Điểm: 0.25]. TỔNG ĐIỂM CÁC BƯỚC PHẢI LÀ 10.0."
}`;

      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      const matchData = imageBase64.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
      if (matchData) {
        mimeType = matchData[1];
        base64Data = matchData[2].trim();
      }

      let ai = getGoogleGenAI(undefined);
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
      
      res.json(JSON.parse(response.text || "{}"));
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

      const gradingPrompt = `Bạn là một giáo viên chấm thi xuất sắc... (Rút gọn)
      Đánh giá bài làm của học sinh theo thang điểm 10. Trả về chi tiết và kết luận điểm số: "TỔNG ĐIỂM: X / 10"`;

      const promptParts = [];
      promptParts.push({ text: gradingPrompt });

      if (submission.images && submission.images.length > 0) {
        promptParts.push({ text: "\n\n--- HÌNH ẢNH BÀI LÀM CỦA HỌC SINH ---" });
        for (const img of submission.images) {
           let mimeType = 'image/jpeg';
           let base64Data = '';
           if (img.startsWith('http')) {
              // Ignore fetching in this fallback, just use what we have or skip
           } else {
             const m = img.match(/^data:(image\/[a-z]+);base64,([\s\S]+)$/);
             if (m) { mimeType = m[1]; base64Data = m[2].trim(); }
           }
           if (base64Data) {
              promptParts.push({ inlineData: { mimeType, data: base64Data } });
           }
        }
      }

      let ai = getGoogleGenAI(studentApiKey);
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: promptParts
      });

      const aiFeedback = response.text || "";
      const score = extractScoreFromText(aiFeedback);
      res.json({ aiFeedback, score });
    } catch (err: any) {
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
