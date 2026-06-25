const apiKeyService = require("../services/apiKeyServe");
const ApiKey = require("../models/ApiKey");

/**
 * List the authenticated user's saved API keys (masked).
 * @route GET /api/settings/api-keys
 */
exports.listApiKeys = async (req, res) => {
  try {
    const keys = await apiKeyService.listKeys(req.userId);
    res.json({ keys, providers: ApiKey.SUPPORTED_PROVIDERS });
  } catch (error) {
    console.error("Error listing API keys:", error);
    res.status(500).json({ message: "Failed to list API keys" });
  }
};

/**
 * Add or update an API key for a provider.
 * @route POST /api/settings/api-keys
 * @body { provider, key, label? }
 */
exports.saveApiKey = async (req, res) => {
  try {
    const { provider, key, label } = req.body;

    if (!provider || !key) {
      return res.status(400).json({ message: "provider and key are required" });
    }
    if (!ApiKey.SUPPORTED_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        message: `Unsupported provider. Allowed: ${ApiKey.SUPPORTED_PROVIDERS.join(", ")}`,
      });
    }
    if (typeof key !== "string" || key.trim().length < 8) {
      return res.status(400).json({ message: "Key looks invalid" });
    }

    const saved = await apiKeyService.addKey(
      req.userId,
      provider,
      key.trim(),
      label?.trim() || ""
    );
    res.status(201).json({ key: saved });
  } catch (error) {
    console.error("Error saving API key:", error);
    res.status(500).json({ message: "Failed to save API key" });
  }
};

/**
 * Delete an API key by id.
 * @route DELETE /api/settings/api-keys/:id
 */
exports.deleteApiKey = async (req, res) => {
  try {
    const ok = await apiKeyService.deleteKey(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ message: "Key not found" });
    res.json({ message: "Key deleted" });
  } catch (error) {
    console.error("Error deleting API key:", error);
    res.status(500).json({ message: "Failed to delete API key" });
  }
};
