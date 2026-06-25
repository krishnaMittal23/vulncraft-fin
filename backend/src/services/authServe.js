const User = require("../models/User");

/**
 * Get user details by ID
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} - User object (without accessToken)
 */
exports.getUserById = async (userId) => {
  return await User.findById(userId).select("-accessToken");
};

/**
 * Get user by GitHub ID
 * @param {string} githubId - GitHub ID
 * @returns {Promise<Object>} - User object
 */
exports.getUserByGithubId = async (githubId) => {
  return await User.findOne({ githubId }).select("-accessToken");
};

/**
 * Create or update a user from a GitHub OAuth profile.
 * @param {Object} profile - { githubId, username, email, avatar, accessToken }
 * @returns {Promise<Object>} - Mongoose user document (includes accessToken)
 */
exports.upsertGithubUser = async (profile) => {
  return await User.findOneAndUpdate(
    { githubId: profile.githubId },
    {
      githubId: profile.githubId,
      username: profile.username,
      email: profile.email,
      avatar: profile.avatar,
      accessToken: profile.accessToken,
      updatedAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};
