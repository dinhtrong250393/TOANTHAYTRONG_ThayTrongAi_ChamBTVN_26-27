import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: "Hello" }],
      config: {
        responseMimeType: "application/json"
      }
    });
    console.log("Success:", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}
run();
