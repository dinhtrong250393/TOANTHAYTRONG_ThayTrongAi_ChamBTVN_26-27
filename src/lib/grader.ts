import { GoogleGenAI } from '@google/genai';

function extractScoreFromText(text: string): number | string {
  const match = text.match(/TỔNG ĐIỂM:\s*([0-9.]+)/i);
  return match ? parseFloat(match[1]) : 'N/A';
}

function getApiKey(customKey?: string): string {
  if (customKey && customKey.trim() !== "") return customKey.trim();
  
  const poolEnv = import.meta.env.VITE_GEMINI_API_KEYS_POOL;
  if (poolEnv) {
    const keys = poolEnv.split(',').map((k: string) => k.trim()).filter(Boolean);
    if (keys.length > 0) {
      // Return a random key from the pool to balance load
      return keys[Math.floor(Math.random() * keys.length)];
    }
  }
  
  // Fallback to standard VITE_GEMINI_API_KEY if exists
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  
  // Last resort: the keys provided by user in the chat (Hardcoded fallback just in case they don't configure VITE_)
  const fallbackKeys: string[] = [];
  if (fallbackKeys.length > 0) {
    return fallbackKeys[Math.floor(Math.random() * fallbackKeys.length)];
  }
  return "";
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runOCR(apiKey: string, base64DataUrl: string, imageType: 'general' | 'teacher_solution' | 'student_work'): Promise<string> {
  let prompt = "";
  if (imageType === "teacher_solution") {
    prompt = `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC nội dung đáp án trong hình ảnh.
Nhiệm vụ: Chuyển đổi hình ảnh đáp án của giáo viên thành văn bản.
- Giữ nguyên các bước giải, công thức toán học.
- Định dạng rõ ràng, dễ đọc.
- BỎ QUA các phần không phải đáp án.`;
  } else if (imageType === "student_work") {
    prompt = `Bạn là chuyên gia OCR toán học. Hãy đọc và gõ lại CHÍNH XÁC nội dung bài làm của học sinh trong hình ảnh.
Nhiệm vụ: Chuyển đổi hình ảnh bài làm thành văn bản.
- Ghi chú lại những chỗ bị mờ, khó đọc là [không rõ chữ].
- Giữ nguyên các công thức, biểu thức, sơ đồ (mô tả bằng lời nếu cần).
- KHÔNG tự ý sửa lỗi sai của học sinh. Ghi chính xác những gì học sinh viết.`;
  } else {
    prompt = `Hãy đọc và chuyển đổi nội dung toán học trong hình ảnh này thành văn bản. Giữ nguyên cấu trúc và công thức.`;
  }

  const match = base64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 image data URL");
  }
  
  const mimeType = match[1];
  const base64Data = match[2].trim();

  let attempt = 0;
  const maxRetries = 2;

  while (attempt < maxRetries) {
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }
        ]
      });
      return response.text || "";
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      await sleep(1000);
    }
  }
  return "";
}

export async function gradeEssayClient(submission: any, essay: any): Promise<{ aiFeedback: string, score: number | string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000); // 55s timeout
  
  try {
    const response = await fetch('/api/grade-essay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission,
        essay,
        studentApiKey: submission.studentApiKey
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Lỗi khi chấm điểm AI');
    }

    return {
      aiFeedback: data.aiFeedback,
      score: data.score
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error("Client side grading error:", err);
    if (err.name === 'AbortError') {
      throw new Error("Quá hạn thời gian chấm bài (Timeout 55s). Hệ thống tự động dừng để tránh bị treo.");
    }
    throw new Error(err.message || "Lỗi không xác định khi chấm điểm.");
  }
}
