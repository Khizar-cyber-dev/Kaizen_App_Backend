import 'dotenv/config';

async function simpleTest() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
        console.error("Missing API Key");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    console.log("Testing with gemini-2.0-flash via v1beta...");

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Write a 5 word review for a coding session."
                    }]
                }]
            })
        });

        const data = await response.json();
        if (response.ok) {
            console.log("✅ Success!");
            console.log("Response:", data.candidates[0].content.parts[0].text);
        } else {
            console.error(`❌ Failed (${response.status})`);
            console.error("Error Detail:", JSON.stringify(data.error || data, null, 2));
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

simpleTest();
