const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // Authentication methods
  githubId: { type: String, unique: true, sparse: true },
  firebaseUid: { type: String, unique: true, sparse: true },
  
  // User info
  username: { type: String, required: true },
  email: { type: String, required: true },
  avatar: String,
  
  // GitHub OAuth
  accessToken: String,
  
  // Firebase specific
  emailVerified: { type: Boolean, default: false },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);


