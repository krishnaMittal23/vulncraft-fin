const githubService = require("../services/githubServe");
const User = require("../models/User");
const authService = require("../services/authServe");

/**
 * Get user object for both Passport and Firebase auth
 */
const getUserObject = async (req) => {
  if (req.user && req.user.id) {
    // Passport authenticated user
    return await User.findById(req.user.id);
  } else if (req.firebaseUid) {
    // Firebase authenticated user
    return await authService.getUserByFirebaseUid(req.firebaseUid);
  }
  return null;
};

/**
 * Get GitHub repositories of the authenticated user
 * @route GET /api/github/repos
 */
exports.getUserRepositories = async (req, res) => {
  try {
    const user = await getUserObject(req);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const repos = await githubService.getUserRepos(user._id);
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
    const user = await getUserObject(req);

    if (!user || !user.accessToken) {
      return res.status(401).json({
        message: "GitHub not linked. Please connect your GitHub account.",
      });
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
    const user = await getUserObject(req);

    if (!user || !user.accessToken) {
      return res.status(401).json({
        message: "GitHub not linked. Please connect your GitHub account.",
      });
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

