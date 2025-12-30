const passport = require("passport");
const authService = require("../services/authServe");

/**
 * GitHub authentication route handler
 * Adding "repo" in scopes help in finding the private repos as well
 * @route GET /api/auth/github
 */
exports.githubAuth = passport.authenticate("github", { scope: ["user:email", "repo"] });

/**
 * GitHub callback handler
 * @route GET /api/auth/github/callback
 */
exports.githubAuthCallback = passport.authenticate("github", {
  failureRedirect: "/login",
});

/**
 * Get current authenticated user
 * @route GET /api/auth/user
 */
exports.getCurrentUser = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const user = await authService.getUserById(req.user.id);
  res.json(user);
};

/**
 * Logout user
 * @route GET /api/auth/logout
 */
exports.logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
};
