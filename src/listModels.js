import 'dotenv/config';

async function listModels() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.models) {
        console.log("Gemini models:");
        data.models
            .filter(m => m.name.includes('gemini'))
            .forEach(m => console.log(m.name));
    } else {
        console.log("No models found.");
    }
}

listModels();
