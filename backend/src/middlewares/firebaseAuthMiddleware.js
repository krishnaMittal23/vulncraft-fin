const admin = require("../config/firebaseConfig");

/**
 * Middleware to check if user is authenticated via Passport (GitHub)
 */
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

/**
 * Middleware to verify Firebase ID token
 */
exports.isFirebaseAuthenticated = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    
    if (!token && !req.session?.firebaseUid) {
      return res.status(401).json({ message: "No authentication token provided" });
    }

    // If token is provided, verify it
    if (token) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.firebaseUid = decodedToken.uid;
      req.firebaseUser = decodedToken;
    } else if (req.session?.firebaseUid) {
      // Check if user is already authenticated via session
      req.firebaseUid = req.session.firebaseUid;
    }

    next();
  } catch (error) {
    console.error("Firebase authentication error:", error);
    res.status(401).json({ message: "Invalid or expired token", error: error.message });
  }
};

/**
 * Middleware to check if user is authenticated via either method (Passport or Firebase)
 */
exports.isAuthenticatedEither = async (req, res, next) => {
  try {
    // Check Passport authentication
    if (req.isAuthenticated()) {
      return next();
    }

    // Check Firebase authentication
    const token = req.headers.authorization?.split("Bearer ")[1];
    
    if (!token && !req.session?.firebaseUid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (token) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.firebaseUid = decodedToken.uid;
      req.firebaseUser = decodedToken;
    } else if (req.session?.firebaseUid) {
      req.firebaseUid = req.session.firebaseUid;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized", error: error.message });
  }
};
