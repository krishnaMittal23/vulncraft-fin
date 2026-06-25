const express = require("express");
const {
  githubAuth,
  githubAuthCallback,
  getCurrentUser,
  logoutUser,
} = require("../controllers/authCont");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

// GitHub OAuth
router.get("/github", githubAuth);
router.get("/github/callback", githubAuthCallback);

// Current user (JWT protected)
router.get("/user", authenticate, getCurrentUser);

// Logout (client-side token discard)
router.get("/logout", logoutUser);

module.exports = router;
