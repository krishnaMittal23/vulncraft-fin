const jwt = require("jsonwebtoken");

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Sign a JWT for an authenticated user.
 * @param {Object} user - Mongoose user document (must have _id)
 * @returns {string} signed JWT
 */
const signToken = (user) => {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verify a JWT and return its decoded payload.
 * @param {string} token
 * @returns {Object} decoded payload ({ id, iat, exp })
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { signToken, verifyToken };
