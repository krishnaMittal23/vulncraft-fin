const analysisService = require("../services/analysisServe");

exports.analyzeCode = async (req, res) => {
  console.log("\n========== CODE ANALYSIS REQUEST ==========");
  try {
    const { code, language } = req.body;
    console.log(`📝 Request: Analyze ${language || 'unknown'} code (${code?.length || 0} chars)`);
    
    if (!code) {
      console.log("❌ Validation failed: No code provided");
      return res.status(400).json({ error: "Code is required" });
    }
    
    const analysisReport = await analysisService.analyzeCode(code, language);
    console.log("✅ Analysis successful, sending response");
    console.log("==========================================\n");
    res.json({ analysis: analysisReport });
  } catch (error) {
    console.error("❌ Error in analyzeCode controller:", error.message);
    console.log("==========================================\n");
    res.status(500).json({ error: "Failed to analyze code" });
  }
};

exports.getQueryAboutCode = async (req, res) => {
  console.log("\n========== REPO CHAT REQUEST ==========");
  try {
    const { code, question } = req.body;
    console.log(`💬 Question: "${question || 'General analysis'}"`);
    console.log(`📚 Files received: ${code?.length || 0}`);
    
    if (Array.isArray(code) && code.length > 0) {
      const totalSize = JSON.stringify(code).length;
      console.log(`📦 Total payload: ${totalSize} bytes (${(totalSize/1024).toFixed(2)} KB)`);
      console.log(`📄 Files:`, code.map(f => f.path || 'unknown').slice(0, 5));
      if (code.length > 5) console.log(`   ... and ${code.length - 5} more files`);
    }

    if (!Array.isArray(code) || code.length === 0) {
      console.log("❌ Validation failed: No code files provided");
      return res
        .status(400)
        .json({ error: "Code files are required in an array." });
    }

    const startTime = Date.now();
    const analysisReport = await analysisService.getQueryAboutCode(code, question);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Chat response generated in ${duration}ms`);
    console.log("==========================================\n");
    res.json({ response: analysisReport });
  } catch (error) {
    console.error("❌ Error in getQueryAboutCode controller:", error.message);
    console.error("Stack:", error.stack);
    console.log("==========================================\n");
    const errorMessage = error.message || "Failed to answer code queries";
    const statusCode = errorMessage.includes('Payload Too Large') ? 413 : 500;
    res.status(statusCode).json({ error: errorMessage });
  }
};
