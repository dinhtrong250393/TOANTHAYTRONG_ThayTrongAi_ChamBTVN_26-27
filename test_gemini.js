import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ override: true });

async function run() {
  let ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Hello`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt
    });
    console.log("Raw response:", response.text);
  } catch (e) {
    console.error(e);
  }
}
run();
