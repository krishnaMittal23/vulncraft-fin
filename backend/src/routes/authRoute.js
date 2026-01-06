const express = require("express");
const {
  githubAuth,
  githubAuthCallback,
  getCurrentUser,
  logoutUser,
} = require("../controllers/authCont");
const {
  firebaseSignup,
  firebaseLogin,
  getCurrentFirebaseUser,
  sendEmailVerification,
  linkGithubToFirebase,
} = require("../controllers/firebaseAuthCont");
const { isAuthenticated, isFirebaseAuthenticated } = require("../middlewares/authMiddleware");
const { FRONTEND_URL } = require("../lib/constant");

const router = express.Router();

// GitHub OAuth routes (existing)
router.get("/github", githubAuth);
router.get("/github/callback", githubAuthCallback, (req, res) => {
  res.redirect(`${FRONTEND_URL}/dashboard`);
});
router.get("/user", isAuthenticated, getCurrentUser);

// Firebase Email/Password routes (new)
router.post("/firebase/signup", firebaseSignup);
router.post("/firebase/login", firebaseLogin);
router.get("/firebase/user", isFirebaseAuthenticated, getCurrentFirebaseUser);
router.post("/firebase/send-verification", sendEmailVerification);
router.post("/firebase/link-github", isFirebaseAuthenticated, linkGithubToFirebase);

// Logout (works for both auth methods)
router.get("/logout", logoutUser);

module.exports = router;
