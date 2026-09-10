const fs = require('fs');

const code = fs.readFileSync('server.ts.tmp', 'utf8');

const newGradeEndpoint = `  app.post("/api/grade-essay", async (req, res) => {
    try {
      const { submission, essay, studentApiKey } = req.body;
      const ai = getGoogleGenAI(getNextApiKey(studentApiKey));
      
      const prompt = \`Bạn là một giáo viên chấm thi tự luận.
Dưới đây là một bài làm tự luận của học sinh (đã được đính kèm dưới dạng hình ảnh) cùng với Đề bài và Lời giải mẫu (đáp án chuẩn).

Nhiệm vụ của bạn:
1. Đọc và nhận diện chữ viết tay/công thức toán học từ hình ảnh bài làm.
2. Cảnh báo nếu hình ảnh quá mờ, không thể đọc được.
3. Đối chiếu từng bước giải quyết trong bài làm của học sinh với lời giải chuẩn.
4. NẾU học sinh giải quyết bài toán theo một cách KHÁC biệt so với đáp án chuẩn NHƯNG logic vẫn đúng và ra kết quả đúng, HÃY CÔNG NHẬN CÁCH LÀM ĐÓ và cho điểm tối đa cho phần đó.
5. Đưa ra nhận xét chi tiết, công tâm: chỉ ra điểm đúng, điểm sai, lỗi tư duy hoặc lỗi tính toán (nếu có), và gọi ý cách khắc phục.
6. Đưa ra điểm số cuối cùng (từ 0 đến 10, có thể lẻ đến 0.25).

TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON TUYỆT ĐỐI THEO ĐỊNH DẠNG SAU:
{
  "score": <điểm số là một số, ví dụ 8.5>,
  "aiFeedback": "<nhận xét chi tiết của bạn>"
}

--- Thông tin bài toán ---
Đề bài:
\${essay.questionText || 'Không có văn bản đề bài'}

Lời giải chuẩn:
\${essay.solutionText || 'Không có lời giải chuẩn, hãy tự giải và chấm theo tư duy logic.'}\`;

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
        contents.push({ text: "Bài làm của học sinh (đã OCR từ ảnh):\\n" + (submission.submissionImages?.join('\\n') || '') });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contents,
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
  });`;

const updatedCode = code.replace("REPLACE_GRADE_HERE", newGradeEndpoint);

fs.writeFileSync('server.ts', updatedCode);
console.log("Patched server.ts successfully");
