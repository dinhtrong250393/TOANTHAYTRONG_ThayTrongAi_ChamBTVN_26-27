import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const prompt = `TRẢ VỀ KẾT QUẢ DƯỚI DẠNG JSON TUYỆT ĐỐI THEO ĐỊNH DẠNG SAU:
{
  "score": 10,
  "aiFeedback": "Tốt"
}`;
    const contents = [{ text: prompt }];
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: contents,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    let text = res.text || "";
    console.log("Raw text:", text);
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) text = match[1];
    text = text.trim();
    console.log("Parsed JSON:", JSON.parse(text));
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}
run();
