const express = require("express");
const router = express.Router();
const codeController = require("../controllers/codeCont");
const { optionalAuthenticate } = require("../middlewares/authMiddleware");

router.post("/security", optionalAuthenticate, codeController.analyzeCode);
router.post("/query", optionalAuthenticate, codeController.getQueryAboutCode);

module.exports = router;
