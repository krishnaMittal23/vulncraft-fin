const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatCont");
const { optionalAuthenticate } = require("../middlewares/authMiddleware");

router.post("/", optionalAuthenticate, chatController.chat);

module.exports = router;
