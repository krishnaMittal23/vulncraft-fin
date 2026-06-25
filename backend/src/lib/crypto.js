const crypto = require("crypto");

const ALGO = "aes-256-gcm";

/**
 * Derive a stable 32-byte key from the env secret.
 * API_KEY_ENCRYPTION_SECRET must be set (any length string).
 */
const getKey = () => {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET is not set — cannot encrypt/decrypt API keys."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
};

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * @returns {{ciphertext: string, iv: string, authTag: string}} all base64
 */
const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
};

/**
 * Decrypt a payload produced by encrypt().
 * @param {{ciphertext: string, iv: string, authTag: string}} payload
 * @returns {string} plaintext
 */
const decrypt = ({ ciphertext, iv, authTag }) => {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

module.exports = { encrypt, decrypt };
