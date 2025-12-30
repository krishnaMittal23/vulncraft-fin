const chatService = require("../services/chatServe");

exports.chat = async (req, res) => {
  console.log("\n========== CHATBOT REQUEST ==========");
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.log("❌ Validation failed: Invalid or empty message");
      return res.status(400).json({ 
        success: false,
        error: "Message is required and must be a non-empty string" 
      });
    }

    console.log(`📝 Processing chat message: "${message.substring(0, 100)}..."`);

    const result = await chatService.chat(message);

    if (result.success) {
      console.log(`✅ Chat successful (${result.responseTime}ms)`);
      res.json(result);
    } else {
      console.log(`❌ Chat failed: ${result.error}`);
      res.status(500).json(result);
    }

  } catch (error) {
    console.error("❌ Unexpected error in chat controller:", error.message);
    console.log("==========================================\n");
    res.status(500).json({ 
      success: false,
      error: "An unexpected error occurred",
      details: error.message 
    });
  }
};
