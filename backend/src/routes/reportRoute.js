const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportCont");
const { authenticate } = require("../middlewares/authMiddleware");

// GET /api/reports - Get all reports
router.get("/", authenticate, reportController.getAllReports);

// GET /api/reports/stats - Get report statistics
router.get("/stats", authenticate, reportController.getReportStats);

// GET /api/reports/:id/logs/download(-zip) - export run logs (must precede /:id)
router.get("/:id/logs/download", authenticate, reportController.downloadLogs);
router.get("/:id/logs/download-zip", authenticate, reportController.downloadLogsZip);

// GET /api/reports/:id - Get single report
router.get("/:id", authenticate, reportController.getReportById);

// GET /api/reports/workflow/:workflowId - Get reports by workflow
router.get("/workflow/:workflowId", authenticate, reportController.getReportsByWorkflow);

// POST /api/reports - Create new report
router.post("/", authenticate, reportController.createReport);

// PUT /api/reports/:id - Update report
router.put("/:id", authenticate, reportController.updateReport);

// DELETE /api/reports/:id - Delete report
router.delete("/:id", authenticate, reportController.deleteReport);

module.exports = router;
