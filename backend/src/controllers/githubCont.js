const githubService = require("../services/githubServe");
const User = require("../models/User");

/**
 * Get GitHub repositories of the authenticated user
 * @route GET /api/github/repos
 */
exports.getUserRepositories = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const repos = await githubService.getUserRepos(req.user.id);
    res.json(repos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * API to fetch the entire code of a GitHub repository
 * @route GET /api/github/repo/:owner/:repo
 */
exports.fetchRepositoryCode = async (req, res) => {
  const { owner, repo } = req.params;

  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.accessToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const files = await githubService.fetchRepoContents(
      owner,
      repo,
      "",
      user.accessToken
    );
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a GitHub issue in a repository
 * @route POST /api/github/repos/:owner/:repo/issues
 */
exports.createIssue = async (req, res) => {
  const { owner, repo } = req.params;
  const { title, body, labels } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.accessToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const issue = await githubService.createGitHubIssue(
      owner,
      repo,
      title,
      body,
      labels || [],
      user.accessToken
    );

    res.json(issue);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
