const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workflow",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  workflowName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["running", "completed", "failed", "partial"],
    default: "running",
  },
  targetUrl: {
    type: String,
    required: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  duration: {
    type: Number, // in milliseconds
  },
  results: {
    type: Object,
    default: {},
  },
  findings: {
    total: {
      type: Number,
      default: 0,
    },
    high: {
      type: Number,
      default: 0,
    },
    medium: {
      type: Number,
      default: 0,
    },
    low: {
      type: Number,
      default: 0,
    },
  },
  nodeResults: [{
    nodeId: String,
    nodeType: String,
    status: String,
    output: Object,
    detailedAnalysis: Object, 
    startTime: Date,
    endTime: Date,
    duration: Number,
  }],
  executionErrors: [{
    nodeId: String,
    nodeType: String,
    message: String,
    timestamp: Date,
  }],
  // Consolidated report produced by the report pipeline (normalize → dedupe →
  // score → LLM synthesis): { overallRisk, riskScore, counts, findings[],
  // executiveSummary, topRisks[], remediation[] }.
  summary: {
    type: Object,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

reportSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Calculate duration if endTime is set
  if (this.endTime && this.startTime) {
    this.duration = this.endTime - this.startTime;
  }

  next();
});

// Common access patterns: list a user's reports newest-first, lookups by
// workflow, and the reaper's {status, startTime} sweep.
reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ workflowId: 1, createdAt: -1 });
reportSchema.index({ status: 1, startTime: 1 });

module.exports = mongoose.model("Report", reportSchema);