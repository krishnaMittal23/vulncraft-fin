const express = require("express");
const {
  getUserRepositories,
  fetchRepositoryCode,
  createIssue,
  getOnboarding,
  monitorRepo,
  listMonitored,
  unmonitor,
} = require("../controllers/githubCont");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/repos", authenticate, getUserRepositories);
router.get("/onboarding", authenticate, getOnboarding);
router.post("/monitor", authenticate, monitorRepo);
router.get("/monitored", authenticate, listMonitored);
router.delete("/monitored/:id", authenticate, unmonitor);
router.get("/repo/:owner/:repo", authenticate, fetchRepositoryCode);
router.post("/repos/:owner/:repo/issues", authenticate, createIssue);

module.exports = router;
