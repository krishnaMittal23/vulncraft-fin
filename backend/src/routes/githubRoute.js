const express = require("express");
const {
  getUserRepositories,
  fetchRepositoryCode,
  createIssue,
} = require("../controllers/githubCont");
const { isAuthenticatedEither } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/repos", isAuthenticatedEither, getUserRepositories);
router.get("/repo/:owner/:repo", isAuthenticatedEither, fetchRepositoryCode);
router.post("/repos/:owner/:repo/issues", isAuthenticatedEither, createIssue);

module.exports = router;

