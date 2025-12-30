const express = require("express");
const {
  getUserRepositories,
  fetchRepositoryCode,
  createIssue,
} = require("../controllers/githubCont");
const { isAuthenticated } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/repos", isAuthenticated, getUserRepositories);
router.get("/repo/:owner/:repo", isAuthenticated, fetchRepositoryCode);
router.post("/repos/:owner/:repo/issues", isAuthenticated, createIssue);

module.exports = router;
