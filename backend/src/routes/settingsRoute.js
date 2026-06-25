const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsCont");
const { authenticate } = require("../middlewares/authMiddleware");

// All settings routes require authentication
router.get("/api-keys", authenticate, settingsController.listApiKeys);
router.post("/api-keys", authenticate, settingsController.saveApiKey);
router.delete("/api-keys/:id", authenticate, settingsController.deleteApiKey);

module.exports = router;
