const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // Authentication
  githubId: { type: String, unique: true, sparse: true },

  // User info
  username: { type: String, required: true },
  email: { type: String, required: true },
  avatar: String,

  // GitHub OAuth access token (used for GitHub API calls)
  accessToken: String,

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);
