const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportCont");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// GET /api/reports - Get all reports
router.get("/", isAuthenticated, reportController.getAllReports);

// GET /api/reports/stats - Get report statistics
router.get("/stats", isAuthenticated, reportController.getReportStats);

// GET /api/reports/:id - Get single report
router.get("/:id", isAuthenticated, reportController.getReportById);

// GET /api/reports/workflow/:workflowId - Get reports by workflow
router.get("/workflow/:workflowId", isAuthenticated, reportController.getReportsByWorkflow);

// POST /api/reports - Create new report
router.post("/", isAuthenticated, reportController.createReport);

// PUT /api/reports/:id - Update report
router.put("/:id", isAuthenticated, reportController.updateReport);

// DELETE /api/reports/:id - Delete report
router.delete("/:id", isAuthenticated, reportController.deleteReport);

module.exports = router;
