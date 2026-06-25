const mongoose = require("mongoose");
const archiver = require("archiver");
const Report = require("../models/Report");

const fmtLog = (l) =>
  `[${new Date(l.timestamp).toISOString()}] ${(l.level || "info").toUpperCase()}` +
  `${l.nodeType ? ` (${l.nodeType})` : ""}: ${l.message}`;

// Get all reports for a user
exports.getAllReports = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const reports = await Report.find({ userId })
      .sort({ createdAt: -1 })
      .populate("workflowId", "name");
    
    res.json({ reports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

// Get single report by ID
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const report = await Report.findOne({ _id: id, userId })
      .populate("workflowId", "name");
    
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ report });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
};

// Get reports by workflow ID
exports.getReportsByWorkflow = async (req, res) => {
  try {
    const { workflowId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const reports = await Report.find({ workflowId, userId })
      .sort({ createdAt: -1 });
    
    res.json({ reports });
  } catch (error) {
    console.error("Error fetching workflow reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

// Create new report
exports.createReport = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { workflowId, workflowName, targetUrl } = req.body;

    const report = new Report({
      workflowId,
      workflowName,
      targetUrl,
      userId,
      status: "running",
    });

    await report.save();
    res.status(201).json({ report });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
};

// Update report
exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Allow-list updatable fields — never let the client set userId/_id/findings/etc.
    const ALLOWED = ["status", "notes"];
    const update = {};
    for (const k of ALLOWED) if (k in req.body) update[k] = req.body[k];

    const report = await Report.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ report });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: "Failed to update report" });
  }
};

// Delete report
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const report = await Report.findOneAndDelete({ _id: id, userId });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Failed to delete report" });
  }
};

// Get report statistics
exports.getReportStats = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const totalReports = await Report.countDocuments({ userId });
    const completedReports = await Report.countDocuments({ userId, status: "completed" });
    const failedReports = await Report.countDocuments({ userId, status: "failed" });
    const runningReports = await Report.countDocuments({ userId, status: "running" });

    // Get total findings
    const findingsAgg = await Report.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalFindings: { $sum: "$findings.total" },
          highFindings: { $sum: "$findings.high" },
          mediumFindings: { $sum: "$findings.medium" },
          lowFindings: { $sum: "$findings.low" },
        }
      }
    ]);

    const findings = findingsAgg[0] || {
      totalFindings: 0,
      highFindings: 0,
      mediumFindings: 0,
      lowFindings: 0,
    };

    res.json({
      stats: {
        totalReports,
        completedReports,
        failedReports,
        runningReports,
        findings,
      }
    });
  } catch (error) {
    console.error("Error fetching report stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
};

// GET /api/reports/:id/logs/download — plaintext run logs
exports.downloadLogs = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    const report = await Report.findOne({ _id: id, userId: req.userId });
    if (!report) return res.status(404).json({ error: "Report not found" });

    const logs = report.results?.logs || [];
    const header =
      `VulnCraft run — ${report.workflowName}\n` +
      `Target: ${report.targetUrl}\nStatus: ${report.status}\n` +
      `Started: ${report.startTime}\nDuration: ${report.duration ?? "—"}ms\n` +
      `${"=".repeat(60)}\n`;
    const body = logs.length
      ? logs.map(fmtLog).join("\n")
      : "(no logs were captured for this run)";

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="run-${id}-logs.txt"`);
    res.send(header + body);
  } catch (error) {
    console.error("Error downloading logs:", error);
    res.status(500).json({ error: "Failed to download logs" });
  }
};

// GET /api/reports/:id/logs/download-zip — logs grouped by node + per-node results
exports.downloadLogsZip = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    const report = await Report.findOne({ _id: id, userId: req.userId });
    if (!report) return res.status(404).json({ error: "Report not found" });

    const logs = report.results?.logs || [];
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="run-${id}-logs.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("zip error:", err.message);
      try { res.status(500).end(); } catch { /* headers already sent */ }
    });
    archive.pipe(res);

    archive.append(JSON.stringify({
      workflow: report.workflowName, target: report.targetUrl, status: report.status,
      startTime: report.startTime, duration: report.duration, findings: report.findings,
      executionErrors: report.executionErrors,
    }, null, 2), { name: "summary.json" });

    archive.append(logs.length ? logs.map(fmtLog).join("\n") : "(none)", { name: "all-logs.txt" });

    // logs grouped per node
    const byNode = {};
    for (const l of logs) {
      const k = l.nodeType || "workflow";
      (byNode[k] = byNode[k] || []).push(fmtLog(l));
    }
    for (const [node, lines] of Object.entries(byNode)) {
      archive.append(lines.join("\n"), { name: `nodes/${node}.txt` });
    }

    // per-node raw results + AI analysis
    for (const n of report.nodeResults || []) {
      archive.append(JSON.stringify({
        status: n.status, duration: n.duration, output: n.output, analysis: n.detailedAnalysis,
      }, null, 2), { name: `results/${n.nodeType}-${n.nodeId}.json` });
    }

    await archive.finalize();
  } catch (error) {
    console.error("Error zipping logs:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to build logs archive" });
  }
};
