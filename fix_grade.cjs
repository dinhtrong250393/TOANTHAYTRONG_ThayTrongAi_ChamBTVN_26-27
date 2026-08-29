const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const startIndex = content.indexOf('app.post("/api/grade-essay",');
const endIndex = content.indexOf('  // Vite middleware for development');

if (startIndex !== -1 && endIndex !== -1) {
  const correctBlock = `app.post("/api/grade-essay", async (req, res) => {
    try {
      const { essay, submission, studentApiKey } = req.body;
      if (!essay || !submission) {
        return res.status(400).json({ error: "Thiếu thông tin bài kiểm tra hoặc bài làm." });
      }

      const gradingPrompt = \`Bạn là một giáo viên chấm thi xuất sắc. Nhiệm vụ của bạn là chấm điểm bài làm tự luận của học sinh dựa trên đề bài và đáp án chuẩn (hoặc barem điểm) của giáo viên đưa ra.

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

QUY TẮC TOÁN HỌC: Trình bày công thức toán học một cách trực quan bằng unicode (VD: x², √x, phân số a/b), KHÔNG dùng LaTeX thô (như \\\\frac).\`;

      const promptParts = [];
      promptParts.push({ text: gradingPrompt });

      if (essay.questionText) { promptParts.push({ text: "\\n\\n--- NỘI DUNG ĐỀ BÀI (VĂN BẢN) ---\\n" + essay.questionText }); }
      if (essay.solutionText) { promptParts.push({ text: "\\n\\n--- ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (CÓ BAREM ĐIỂM) ---\\n" + essay.solutionText }); }

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
          const m = imgStr.match(/^data:(image\\/[a-z]+);base64,([\\s\\S]+)$/);
          if (m) { mimeType = m[1]; base64Data = m[2].trim(); }
        }
        if (base64Data) return { inlineData: { mimeType, data: base64Data } };
        return null;
      };

      if (!essay.questionText && essay.assignmentImages && essay.assignmentImages.length > 0) {
        promptParts.push({ text: "\\n\\n--- HÌNH ẢNH ĐỀ BÀI (HÃY ĐỌC ĐỀ BÀI TỪ CÁC HÌNH DƯỚI ĐÂY) ---" });
        for (const img of essay.assignmentImages) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      if (!essay.solutionText && essay.solutionImages && essay.solutionImages.length > 0) {
        promptParts.push({ text: "\\n\\n--- HÌNH ẢNH ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (HÃY THAM KHẢO) ---" });
        for (const img of essay.solutionImages) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
        }
      }

      if (submission.images && submission.images.length > 0) {
        promptParts.push({ text: "\\n\\n--- HÌNH ẢNH BÀI LÀM CỦA HỌC SINH (HÃY PHÂN TÍCH VÀ CHẤM ĐIỂM CHÍNH XÁC NÉT CHỮ VIẾT TAY TRÊN ẢNH DƯỚI ĐÂY) ---" });
        for (const img of submission.images) {
          const part = await fetchImageAsBase64Part(img);
          if (part) promptParts.push(part);
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
    } catch (err) {
      console.error("[AI Grading Pipeline ERROR]:", err);
      res.status(500).json({ error: err.message || "Lỗi khi chấm điểm AI tự luận" });
    }
  });

`;
  
  content = content.substring(0, startIndex) + correctBlock + content.substring(endIndex);
  fs.writeFileSync('server.ts', content);
}
