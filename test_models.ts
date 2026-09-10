import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: [{ text: "Hello" }],
    });
    console.log("1.5-pro Success:", res.text);
  } catch (e: any) {
    console.log("1.5-pro Error:", e.message);
  }

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ text: "Hello" }],
    });
    console.log("1.5-flash Success:", res.text);
  } catch (e: any) {
    console.log("1.5-flash Error:", e.message);
  }

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ text: "Hello" }],
    });
    console.log("2.0-flash Success:", res.text);
  } catch (e: any) {
    console.log("2.0-flash Error:", e.message);
  }

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: "Hello" }],
    });
    console.log("2.5-flash Success:", res.text);
  } catch (e: any) {
    console.log("2.5-flash Error:", e.message);
  }
}
run();
