const axios = require("axios");


const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";


exports.generateFlowChart = async (text) => {
  try {
    const prompt = `Based on these text, generate a Mermaid.js flowchart diagram showing the system architecture:
        ${text}
        
        Include:
        1. Main components and their relationships
        2. Data flow
        3. External services
        4. Key processes
        
        Respond only with the Mermaid.js diagram code, no explanations.`;


    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "system", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );


    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenRouter API error:", error);
    throw new Error("Failed to generate Mermaid.js diagram");
  }
};