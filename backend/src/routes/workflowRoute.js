const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const workflowController = require("../controllers/workflowCont");
const { authenticate } = require("../middlewares/authMiddleware");

const executeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many workflow executions, please wait." },
});

// GET /api/workflows - Get all workflows
router.get("/", authenticate, workflowController.getAllWorkflows);

// GET /api/workflows/:id - Get single workflow
router.get("/:id", authenticate, workflowController.getWorkflowById);

// POST /api/workflows - Create new workflow
router.post("/", authenticate, workflowController.createWorkflow);

// PUT /api/workflows/:id - Update workflow
router.put("/:id", authenticate, workflowController.updateWorkflow);

// DELETE /api/workflows/:id - Delete workflow
router.delete("/:id", authenticate, workflowController.deleteWorkflow);

// POST /api/workflows/:id/execute - Execute workflow
router.post("/:id/execute", authenticate, executeLimiter, workflowController.executeWorkflow);

module.exports = router;
