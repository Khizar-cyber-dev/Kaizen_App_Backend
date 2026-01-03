import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

async function testGemini() {
    try {
        console.log("--- Gemini 2.0 Flash Production Test ---");

        // Clean the API key
        let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (apiKey) apiKey = apiKey.trim();

        if (!apiKey) {
            console.error("❌ ERROR: GOOGLE_GENERATIVE_AI_API_KEY is missing in .env");
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        console.log("Requesting generation...");
        const prompt = "Write a professional email subject and summary for a successful 7-day habit streak for Khizar.";

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        console.log("\n--- AI Response ---");
        console.log(text);
        console.log("-------------------\n");

        fs.writeFileSync("gemini_output.txt", text);
        console.log("✅ Result saved to gemini_output.txt");

    } catch (error) {
        if (error.status === 429) {
            console.error("❌ ERROR: Rate Limit Exceeded (429). Google is temporarily blocking requests from this key.");
            console.error("👉 Please wait 60 seconds and try again: node src/geminiTesting.js");
        } else {
            console.error("❌ Error:", error.message || error);
        }
    }
}

testGemini();
