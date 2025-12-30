const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  githubId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  avatar: String,
  email: String,
  accessToken: String
});

module.exports = mongoose.model("User", userSchema);


