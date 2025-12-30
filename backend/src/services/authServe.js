const User = require("../models/User");

/**
 * Get user details by ID
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} - User object
 */
exports.getUserById = async (userId) => {
  return await User.findById(userId).select("-accessToken");
};