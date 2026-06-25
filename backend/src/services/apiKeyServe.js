const ApiKey = require("../models/ApiKey");
const { encrypt, decrypt } = require("../lib/crypto");

const mask = (doc) => ({
  id: doc._id,
  provider: doc.provider,
  label: doc.label,
  last4: doc.last4,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

/**
 * List a user's API keys (masked — never returns the secret).
 */
exports.listKeys = async (userId) => {
  const keys = await ApiKey.find({ userId }).sort({ provider: 1, createdAt: 1 });
  return keys.map(mask);
};

/**
 * Add a new key for a provider. Users can store multiple keys per provider
 * (a fallback pool). Returns the masked record.
 */
exports.addKey = async (userId, provider, key, label = "") => {
  const { ciphertext, iv, authTag } = encrypt(key);
  const doc = await ApiKey.create({
    userId,
    provider,
    label,
    ciphertext,
    iv,
    authTag,
    last4: key.slice(-4),
  });
  return mask(doc);
};

/**
 * Delete a user's key by id. Returns true if a key was removed.
 */
exports.deleteKey = async (userId, id) => {
  const res = await ApiKey.deleteOne({ _id: id, userId });
  return res.deletedCount > 0;
};

/**
 * Internal use only: ALL of a user's decrypted keys for a provider, oldest
 * first (the fallback pool order). Undecryptable rows are skipped.
 */
exports.getDecryptedKeys = async (userId, provider) => {
  const docs = await ApiKey.find({ userId, provider }).sort({ createdAt: 1 });
  const out = [];
  for (const doc of docs) {
    try {
      out.push(decrypt(doc));
    } catch {
      // skip keys that fail to decrypt (e.g. rotated encryption secret)
    }
  }
  return out;
};

/** Back-compat: the first available decrypted key for a provider, or null. */
exports.getDecryptedKey = async (userId, provider) => {
  const keys = await exports.getDecryptedKeys(userId, provider);
  return keys[0] || null;
};
