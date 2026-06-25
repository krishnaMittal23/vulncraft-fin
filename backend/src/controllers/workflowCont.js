const Workflow = require("../models/Workflow");
const { executeWorkflow } = require("../services/workflowExecutionServe");

// Get all workflows for a user
exports.getAllWorkflows = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const workflows = await Workflow.find({ userId }).sort({ updatedAt: -1 });
    res.json({ workflows });
  } catch (error) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
};

// Get single workflow by ID
exports.getWorkflowById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const workflow = await Workflow.findOne({ _id: id, userId });
    
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json({ workflow });
  } catch (error) {
    console.error("Error fetching workflow:", error);
    res.status(500).json({ error: "Failed to fetch workflow" });
  }
};

// Create new workflow
exports.createWorkflow = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, description, type, nodes, edges } = req.body;

    const workflow = new Workflow({
      name,
      description,
      type,
      nodes: nodes || [],
      edges: edges || [],
      userId,
    });

    await workflow.save();
    res.status(201).json({ workflow });
  } catch (error) {
    console.error("Error creating workflow:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
};

// Update workflow
exports.updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Allow-list updatable fields — never let the client set userId/_id/etc.
    const ALLOWED = ["name", "description", "type", "nodes", "edges", "status", "schedule", "executionMode"];
    const update = {};
    for (const k of ALLOWED) if (k in req.body) update[k] = req.body[k];

    const workflow = await Workflow.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true }
    );

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json({ workflow });
  } catch (error) {
    console.error("Error updating workflow:", error);
    res.status(500).json({ error: "Failed to update workflow" });
  }
};

// Delete workflow
exports.deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const workflow = await Workflow.findOneAndDelete({ _id: id, userId });

    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    res.json({ message: "Workflow deleted successfully" });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    res.status(500).json({ error: "Failed to delete workflow" });
  }
};

// Execute workflow
exports.executeWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(`\n🚀 Starting workflow execution: ${id}`);

    // Idempotency: don't let a double-click / retry launch a second concurrent
    // run of the same workflow (which would duplicate scans + reports).
    const Report = require("../models/Report");
    const active = await Report.findOne({ workflowId: id, userId, status: "running" }).select("_id");
    if (active) {
      return res.status(409).json({
        error: "This workflow is already running",
        workflowId: id,
        reportId: active._id,
      });
    }

    // Get io instance from app
    const io = req.app.get('io');

    // Prefer the durable queue when Redis is configured (survives restarts,
    // bounded concurrency); otherwise run in-process (single-instance dev).
    const { redisEnabled } = require("../lib/redis");
    const { enqueueWorkflow } = require("../lib/workflowQueue");

    if (redisEnabled()) {
      await enqueueWorkflow(id, userId);
      console.log(`📥 Workflow ${id} enqueued`);
    } else {
      executeWorkflow(id, userId, io)
        .then(() => console.log(`✅ Workflow ${id} completed successfully`))
        .catch((error) => console.error(`❌ Workflow ${id} failed:`, error.message));
    }

    // Return immediately with 202 Accepted
    res.status(202).json({
      message: "Workflow execution started",
      workflowId: id,
      status: "running",
      queued: redisEnabled(),
    });

  } catch (error) {
    console.error("Error starting workflow execution:", error);
    res.status(500).json({ error: "Failed to start workflow execution" });
  }
};
