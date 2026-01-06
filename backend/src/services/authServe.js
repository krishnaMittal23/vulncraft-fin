const User = require("../models/User");

/**
 * Get user details by ID (GitHub/Passport auth)
 * @param {string} userId - MongoDB user ID
 * @returns {Promise<Object>} - User object
 */
exports.getUserById = async (userId) => {
  return await User.findById(userId).select("-accessToken");
};

/**
 * Get user by Firebase UID
 * @param {string} firebaseUid - Firebase UID
 * @returns {Promise<Object>} - User object
 */
exports.getUserByFirebaseUid = async (firebaseUid) => {
  return await User.findOne({ firebaseUid }).select("-accessToken");
};

/**
 * Create a new Firebase user in MongoDB
 * @param {Object} userData - User data {firebaseUid, email, username, avatar, emailVerified}
 * @returns {Promise<Object>} - Created user object
 */
exports.createFirebaseUser = async (userData) => {
  try {
    const user = await User.create({
      firebaseUid: userData.firebaseUid,
      email: userData.email,
      username: userData.username,
      avatar: userData.avatar || null,
      emailVerified: userData.emailVerified || false,
    });
    return user;
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const existingUser = await User.findOne({
        $or: [{ firebaseUid: userData.firebaseUid }, { email: userData.email }],
      });
      return existingUser;
    }
    throw error;
  }
};

/**
 * Update Firebase user with GitHub info
 * @param {string} firebaseUid - Firebase UID
 * @param {Object} githubData - GitHub data {githubId, accessToken}
 * @returns {Promise<Object>} - Updated user object
 */
exports.updateUserWithGithub = async (firebaseUid, githubData) => {
  return await User.findOneAndUpdate(
    { firebaseUid },
    {
      githubId: githubData.githubId,
      accessToken: githubData.accessToken,
    },
    { new: true }
  ).select("-accessToken");
};

/**
 * Get user by GitHub ID (for backward compatibility)
 * @param {string} githubId - GitHub ID
 * @returns {Promise<Object>} - User object
 */
exports.getUserByGithubId = async (githubId) => {
  return await User.findOne({ githubId }).select("-accessToken");
};