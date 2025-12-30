const express = require("express");
const router = express.Router();
const workflowController = require("../controllers/workflowCont");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// GET /api/workflows - Get all workflows
router.get("/", isAuthenticated, workflowController.getAllWorkflows);

// GET /api/workflows/:id - Get single workflow
router.get("/:id", isAuthenticated, workflowController.getWorkflowById);

// POST /api/workflows - Create new workflow
router.post("/", isAuthenticated, workflowController.createWorkflow);

// PUT /api/workflows/:id - Update workflow
router.put("/:id", isAuthenticated, workflowController.updateWorkflow);

// DELETE /api/workflows/:id - Delete workflow
router.delete("/:id", isAuthenticated, workflowController.deleteWorkflow);

// POST /api/workflows/:id/execute - Execute workflow
router.post("/:id/execute", isAuthenticated, workflowController.executeWorkflow);

module.exports = router;
