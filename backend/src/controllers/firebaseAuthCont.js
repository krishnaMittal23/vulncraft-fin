const admin = require("../config/firebaseConfig");
const authService = require("../services/authServe");

/**
 * Firebase Email/Password Signup
 * @route POST /api/auth/firebase/signup
 * @body {email, password, username}
 */
exports.firebaseSignup = async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // Validate input
    if (!email || !password || !username) {
      return res.status(400).json({
        message: "Email, password, and username are required",
      });
    }

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username,
    });

    // Create user in MongoDB
    const user = await authService.createFirebaseUser({
      firebaseUid: userRecord.uid,
      email,
      username,
      avatar: null,
    });

    // Set custom claims (optional)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      mongoId: user._id.toString(),
    });

    res.status(201).json({
      message: "User created successfully. Please verify your email.",
      user,
    });
  } catch (error) {
    console.error("Firebase signup error:", error);
    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({
        message: "Email already exists. Please use a different email.",
      });
    }
    if (error.code === "auth/invalid-password") {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }
    res.status(500).json({ 
      message: "Signup failed", 
      error: error.message,
      code: error.code 
    });
  }
};

/**
 * Firebase Email/Password Login
 * @route POST /api/auth/firebase/login
 * @body {email, password}
 */
exports.firebaseLogin = async (req, res) => {
  try {
    const { email, idToken } = req.body;

    if (!email || !idToken) {
      return res.status(400).json({
        message: "Email and ID token are required",
      });
    }

    // Verify ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;

    // Get or create user in MongoDB
    let user = await authService.getUserByFirebaseUid(firebaseUid);

    if (!user) {
      // Create user if doesn't exist
      const userRecord = await admin.auth().getUser(firebaseUid);
      user = await authService.createFirebaseUser({
        firebaseUid,
        email: userRecord.email,
        username: userRecord.displayName || email.split("@")[0],
        avatar: userRecord.photoURL || null,
        emailVerified: userRecord.emailVerified,
      });
    }

    // Set session or return user data
    req.session.userId = user._id.toString();
    req.session.firebaseUid = firebaseUid;

    res.json({
      message: "Login successful",
      user,
      firebaseUid,
    });
  } catch (error) {
    console.error("Firebase login error:", error);
    res.status(401).json({ message: "Login failed", error: error.message });
  }
};

/**
 * Get current Firebase authenticated user
 * @route GET /api/auth/firebase/user
 */
exports.getCurrentFirebaseUser = async (req, res) => {
  try {
    const firebaseUid = req.session?.firebaseUid || req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await authService.getUserByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error getting Firebase user:", error);
    res.status(500).json({ message: "Error fetching user", error: error.message });
  }
};

/**
 * Send email verification
 * @route POST /api/auth/firebase/send-email-verification
 * @body {email}
 */
exports.sendEmailVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await admin.auth().getUserByEmail(email);

    // Generate email verification link
    const verificationLink = await admin
      .auth()
      .generateEmailVerificationLink(email);

    // You can send this link via email
    // For now, we'll return it (in production, send via email service)
    res.json({
      message: "Verification link generated",
      verificationLink, // In production, send via email instead
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res
      .status(500)
      .json({
        message: "Failed to generate verification link",
        error: error.message,
      });
  }
};

/**
 * Link GitHub to Firebase user
 * @route POST /api/auth/firebase/link-github
 * @body {firebaseUid, githubAccessToken, githubProfile}
 */
exports.linkGithubToFirebase = async (req, res) => {
  try {
    const { firebaseUid, githubAccessToken, githubProfile } = req.body;

    if (!firebaseUid || !githubAccessToken || !githubProfile) {
      return res.status(400).json({
        message: "FirebaseUid, githubAccessToken, and githubProfile are required",
      });
    }

    // Update user with GitHub info
    const user = await authService.updateUserWithGithub(firebaseUid, {
      githubId: githubProfile.id,
      accessToken: githubAccessToken,
    });

    res.json({
      message: "GitHub linked successfully",
      user,
    });
  } catch (error) {
    console.error("GitHub linking error:", error);
    res
      .status(500)
      .json({
        message: "Failed to link GitHub",
        error: error.message,
      });
  }
};
