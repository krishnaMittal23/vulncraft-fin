const githubService = require("../services/githubServe");
const User = require("../models/User");

/**
 * Get the authenticated user document (from the JWT `req.userId`).
 */
const getUserObject = async (req) => {
  if (!req.userId) return null;
  return await User.findById(req.userId);
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
    console.error(error);
    res.status(500).json({ message: "Failed to fetch repositories" });
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
    console.error(error);
    res.status(500).json({ message: "Failed to fetch repository contents" });
  }
};

/**
 * Onboarding info: tells the UI which seamless-connect options are available.
 * @route GET /api/github/onboarding
 */
exports.getOnboarding = async (req, res) => {
  try {
    res.json(githubService.getOnboardingInfo());
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load onboarding info" });
  }
};

/**
 * One-click connect: monitor a repo + auto-register its webhook.
 * @route POST /api/github/monitor
 */
exports.monitorRepo = async (req, res) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) {
    return res.status(400).json({ message: "owner and repo are required" });
  }
  try {
    const result = await githubService.monitorRepository(req.userId, owner, repo);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to connect repository" });
  }
};

/**
 * List monitored repos (authenticated; proxied to the scanner service).
 * @route GET /api/github/monitored
 */
exports.listMonitored = async (req, res) => {
  try {
    const data = await githubService.listMonitoredRepos();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to load monitored repositories" });
  }
};

/**
 * Stop monitoring a repo.
 * @route DELETE /api/github/monitored/:id
 */
exports.unmonitor = async (req, res) => {
  try {
    const data = await githubService.unmonitorRepo(req.params.id);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to remove repository" });
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
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to create issue",
    });
  }
};

