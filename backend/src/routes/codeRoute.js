const express = require("express");
const router = express.Router();
const codeController = require("../controllers/codeCont");

router.post("/security", codeController.analyzeCode);
router.post("/query", codeController.getQueryAboutCode);

module.exports = router;
