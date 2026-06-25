const mongoose = require("mongoose");

const SUPPORTED_PROVIDERS = ["openai", "openrouter", "anthropic", "gemini"];

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  provider: {
    type: String,
    enum: SUPPORTED_PROVIDERS,
    required: true,
  },
  label: { type: String, default: "" },

  // Encrypted secret (AES-256-GCM) — never stored or returned in plaintext
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },

  // Last 4 chars of the key, for display only
  last4: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Users may store MULTIPLE keys per provider (a fallback pool) — non-unique index.
apiKeySchema.index({ userId: 1, provider: 1 });

const ApiKey = mongoose.model("ApiKey", apiKeySchema);
ApiKey.SUPPORTED_PROVIDERS = SUPPORTED_PROVIDERS;

module.exports = ApiKey;
