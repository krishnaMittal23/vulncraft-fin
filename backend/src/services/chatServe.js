const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 30000, // 30 second timeout
});

/**
 * Simple chat function to test LLM connectivity
 * @param {string} message - User's message
 * @returns {Promise<object>} - Chat response with timing info
 */
async function chat(message) {
  console.log("\n========== SIMPLE CHAT REQUEST ==========");
  console.log(`💬 User message: "${message}"`);
  console.log(`📤 Sending to LLM...`);

  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [
        { role: "system", content: "You are a helpful assistant. Keep your responses concise and friendly." },
        { role: "user", content: message },
      ],
      max_tokens: 500, // Limit response size for quick testing
    });

    const duration = Date.now() - startTime;

    console.log(`✅ LLM responded in ${duration}ms`);
    console.log(`📥 Response structure:`, {
      hasResponse: !!response,
      hasChoices: !!response?.choices,
      choicesCount: response?.choices?.length,
      hasContent: !!response?.choices?.[0]?.message?.content
    });

    if (!response?.choices?.[0]?.message?.content) {
      console.error("❌ Invalid response structure:", JSON.stringify(response, null, 2));
      throw new Error('Invalid response from AI service.');
    }

    const content = response.choices[0].message.content;
    console.log(`📄 Response: ${content}`);
    console.log("==========================================\n");

    return {
      success: true,
      message: content,
      responseTime: duration,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Chat error after ${duration}ms:`, error.message);
    console.error("Full error:", error);
    console.log("==========================================\n");

    return {
      success: false,
      error: error.message,
      responseTime: duration,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { chat };