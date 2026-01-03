import 'dotenv/config';
import fs from "fs";

async function testGeminiDirect() {
    try {
        console.log("--- Direct Fetch Test (Mirroring Curl) ---");

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
        if (!apiKey) {
            console.error("❌ ERROR: GOOGLE_GENERATIVE_AI_API_KEY is missing in .env");
            return;
        }

        const url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

        console.log("Sending request to Gemini 2.0 Flash...");
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: "Explain how AI works in 5 words."
                            }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ API Error (${response.status}):`, JSON.stringify(data, null, 2));
            return;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("\n--- Response ---");
        console.log(text || "No text in response");
        console.log("----------------\n");

        if (text) {
            fs.writeFileSync("gemini_output.txt", text);
            console.log("✅ Result saved to gemini_output.txt");
        }

    } catch (error) {
        console.error("❌ Fetch Error:", error.message);
    }
}

testGeminiDirect();
