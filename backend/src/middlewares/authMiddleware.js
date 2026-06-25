const { verifyToken } = require("../lib/token");

/**
 * Authenticate a request via a JWT Bearer token.
 * On success sets `req.userId` to the user's MongoDB id.
 */
exports.authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({ message: "No authentication token provided" });
    }

    const decoded = verifyToken(token);
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Soft auth: if a valid Bearer token is present, set `req.userId`; otherwise
 * continue anyway (no 401). Used on public endpoints that should still prefer
 * a logged-in user's saved API keys when available.
 */
exports.optionalAuthenticate = (req, _res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (token) {
      const decoded = verifyToken(token);
      req.userId = decoded.id;
    }
  } catch {
    // ignore invalid token — treat as anonymous
  }
  next();
};
