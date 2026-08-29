awk '
/app.post\("\/api\/grade-essay"/,/res.status\(500\).json/ {
    if ($0 ~ /app.post\("\/api\/grade-essay"/) { skip = 1; }
}
!skip { print $0 }
/res.status\(500\).json/ {
    if (skip) {
        skip = 0;
        getline; getline; getline; # skip catch block closing
        
        # Now print the correct block
        print "  app.post(\"/api/grade-essay\", async (req, res) => {";
        print "    try {";
        print "      const { essay, submission, studentApiKey } = req.body;";
        print "      if (!essay || !submission) {";
        print "        return res.status(400).json({ error: \"Thiếu thông tin bài kiểm tra hoặc bài làm.\" });";
        print "      }";
        print "";
        print "      const gradingPrompt = `Bạn là một giáo viên chấm thi xuất sắc. Nhiệm vụ của bạn là chấm điểm bài làm tự luận của học sinh dựa trên đề bài và đáp án chuẩn (hoặc barem điểm) của giáo viên đưa ra.";
        print "";
        print "HÃY THỰC HIỆN CÁC BƯỚC SAU ĐỂ CHẤM ĐIỂM:";
        print "1. **Phân tích đề bài và Barem điểm**: Xem xét kỹ nội dung đề bài (hình ảnh hoặc văn bản) và đáp án của giáo viên (hình ảnh hoặc văn bản). Nắm bắt chuẩn xác số điểm phân bổ cho từng bước (ví dụ: [Điểm: 0.25]). TỔNG ĐIỂM LUÔN LÀ 10. Nếu không có barem, hãy tự phân bổ 10 điểm hợp lý theo độ khó từng câu/bước.";
        print "2. **Đối chiếu Bài làm**: Đọc kỹ hình ảnh bài làm của học sinh, chú ý từng chi tiết nhỏ, nét chữ viết tay, sự logic trong cách trình bày.";
        print "3. **Đánh giá Chi tiết**: Đối chiếu từng phần của bài làm với đáp án. Ghi chú rõ: học sinh làm đúng bước nào (được cộng bao nhiêu điểm), làm sai/thiếu bước nào (bị trừ/không được bao nhiêu điểm).";
        print "4. **Tổng kết Điểm**: Cần có mục tổng kết điểm rõ ràng bằng cụm từ chính xác: \"TỔNG ĐIỂM: [Số điểm] / 10\" (Ví dụ: TỔNG ĐIỂM: 8.5 / 10). TỐI ĐA LÀ 10 ĐIỂM, LÀM TRÒN ĐẾN 0.25 (ví dụ: 8.0, 8.25, 8.5, 8.75).";
        print "";
        print "ĐỊNH DẠNG TRẢ VỀ (RẤT QUAN TRỌNG):";
        print "**1. Phân tích bài làm**";
        print "- Câu 1 / Bước 1: [Nhận xét...] => [Điểm đạt được]";
        print "- Câu 2 / Bước 2: [Nhận xét...] => [Điểm đạt được]";
        print "...";
        print "";
        print "**2. Lời khuyên cho học sinh**";
        print "- [Gợi ý cách khắc phục lỗi hoặc lời khen ngợi]";
        print "";
        print "**3. TỔNG ĐIỂM: [Số điểm] / 10**";
        print "";
        print "QUY TẮC TOÁN HỌC: Trình bày công thức toán học một cách trực quan bằng unicode (VD: x², √x, phân số a/b), KHÔNG dùng LaTeX thô (như \\\\frac).`;";
        print "";
        print "      const promptParts = [];";
        print "      promptParts.push({ text: gradingPrompt });";
        print "";
        print "      if (essay.questionText) { promptParts.push({ text: \"\\n\\n--- NỘI DUNG ĐỀ BÀI (VĂN BẢN) ---\\n\" + essay.questionText }); }";
        print "      if (essay.solutionText) { promptParts.push({ text: \"\\n\\n--- ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (CÓ BAREM ĐIỂM) ---\\n\" + essay.solutionText }); }";
        print "";
        print "      // Helper to fetch base64 from image URL or passthrough data URI";
        print "      const fetchImageAsBase64Part = async (imgStr: string) => {";
        print "        let mimeType = 'image/jpeg';";
        print "        let base64Data = '';";
        print "        if (imgStr.startsWith('http')) {";
        print "          try {";
        print "            const response = await fetch(imgStr);";
        print "            const arrayBuffer = await response.arrayBuffer();";
        print "            base64Data = Buffer.from(arrayBuffer).toString('base64');";
        print "            mimeType = response.headers.get('content-type') || 'image/jpeg';";
        print "          } catch (e) { console.error('Error fetching image URL:', e); return null; }";
        print "        } else {";
        print "          const m = imgStr.match(/^data:(image\\/[a-z]+);base64,([\\s\\S]+)$/);";
        print "          if (m) { mimeType = m[1]; base64Data = m[2].trim(); }";
        print "        }";
        print "        if (base64Data) return { inlineData: { mimeType, data: base64Data } };";
        print "        return null;";
        print "      };";
        print "";
        print "      if (!essay.questionText && essay.assignmentImages && essay.assignmentImages.length > 0) {";
        print "        promptParts.push({ text: \"\\n\\n--- HÌNH ẢNH ĐỀ BÀI (HÃY ĐỌC ĐỀ BÀI TỪ CÁC HÌNH DƯỚI ĐÂY) ---\" });";
        print "        for (const img of essay.assignmentImages) {";
        print "          const part = await fetchImageAsBase64Part(img);";
        print "          if (part) promptParts.push(part);";
        print "        }";
        print "      }";
        print "";
        print "      if (!essay.solutionText && essay.solutionImages && essay.solutionImages.length > 0) {";
        print "        promptParts.push({ text: \"\\n\\n--- HÌNH ẢNH ĐÁP ÁN CHUẨN CỦA GIÁO VIÊN (HÃY THAM KHẢO) ---\" });";
        print "        for (const img of essay.solutionImages) {";
        print "          const part = await fetchImageAsBase64Part(img);";
        print "          if (part) promptParts.push(part);";
        print "        }";
        print "      }";
        print "";
        print "      if (submission.images && submission.images.length > 0) {";
        print "        promptParts.push({ text: \"\\n\\n--- HÌNH ẢNH BÀI LÀM CỦA HỌC SINH (HÃY PHÂN TÍCH VÀ CHẤM ĐIỂM CHÍNH XÁC NÉT CHỮ VIẾT TAY TRÊN ẢNH DƯỚI ĐÂY) ---\" });";
        print "        for (const img of submission.images) {";
        print "          const part = await fetchImageAsBase64Part(img);";
        print "          if (part) promptParts.push(part);";
        print "        }";
        print "      }";
        print "";
        print "      let ai = getGoogleGenAI(studentApiKey);";
        print "      const response = await ai.models.generateContent({";
        print "        model: \"gemini-3.6-flash\",";
        print "        contents: promptParts";
        print "      });";
        print "";
        print "      const aiFeedback = response.text || \"\";";
        print "      const score = extractScoreFromText(aiFeedback);";
        print "      res.json({ aiFeedback, score });";
        print "    } catch (err: any) {";
        print "      console.error(\"[AI Grading Pipeline ERROR]:\", err);";
        print "      res.status(500).json({ error: err.message || \"Lỗi khi chấm điểm AI tự luận\" });";
        print "    }";
        print "  });";
        next;
    }
}
' server.ts > temp.ts && mv temp.ts server.ts
