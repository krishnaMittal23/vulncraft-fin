const { getOpenRouterClient } = require("../lib/llm");

exports.generateFlowChart = async (text, userId) => {
  try {
    const prompt = `Based on these text, generate a Mermaid.js flowchart diagram showing the system architecture:
        ${text}

        Include:
        1. Main components and their relationships
        2. Data flow
        3. External services
        4. Key processes

        Respond only with the Mermaid.js diagram code, no explanations.`;

    // Goes through the key-pool + fallback client (rotates across OpenRouter keys/models)
    const client = await getOpenRouterClient(userId, { timeout: 30000 });
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenRouter API error:", error);
    throw new Error("Failed to generate Mermaid.js diagram");
  }
};
