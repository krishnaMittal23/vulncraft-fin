const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatCont");

// POST /api/chat - Simple chatbot endpoint to test LLM
router.post("/", chatController.chat);

module.exports = router;
