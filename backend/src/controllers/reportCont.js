const Report = require("../models/Report");

// Get all reports for a user
exports.getAllReports = async (req, res) => {
  try {
    const userId = req.user?._id;
    
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
    const userId = req.user?._id;

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
    const userId = req.user?._id;

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
    const userId = req.user?._id;
    
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
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const report = await Report.findOneAndUpdate(
      { _id: id, userId },
      { $set: req.body },
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
    const userId = req.user?._id;

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
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const totalReports = await Report.countDocuments({ userId });
    const completedReports = await Report.countDocuments({ userId, status: "completed" });
    const failedReports = await Report.countDocuments({ userId, status: "failed" });
    const runningReports = await Report.countDocuments({ userId, status: "running" });

    // Get total findings
    const findingsAgg = await Report.aggregate([
      { $match: { userId: userId } },
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
