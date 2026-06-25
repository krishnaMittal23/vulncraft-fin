const { OpenAI } = require("openai");
const apiKeyService = require("../services/apiKeyServe");

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Statuses worth rotating to the next key/model for:
// 401 invalid/expired key, 402 out of credits, 408/409 transient,
// 429 rate-limited, 5xx upstream. A 400 is a real request bug — surface it.
const ROTATE_ON = new Set([401, 402, 408, 409, 429, 500, 502, 503, 504, 520, 524]);

/**
 * Parse the backend key pool: OPENROUTER_API_KEYS (comma / space / newline
 * separated, e.g. keys from several OpenRouter accounts) merged with the single
 * OPENROUTER_API_KEY. Order preserved, de-duplicated.
 */
const envKeyPool = () => {
  const raw = [process.env.OPENROUTER_API_KEYS, process.env.OPENROUTER_API_KEY]
    .filter(Boolean)
    .join(",");
  return [...new Set(raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean))];
};

/**
 * Ordered list of keys to try for a request: the user's saved key first
 * (if any), then the backend pool.
 */
const getOpenRouterKeys = async (userId) => {
  const keys = [];
  if (userId) {
    try {
      // ALL of the user's saved OpenRouter keys (their personal fallback pool)
      const userKeys = await apiKeyService.getDecryptedKeys(userId, "openrouter");
      for (const k of userKeys) if (k && !keys.includes(k)) keys.push(k);
    } catch {
      // ignore — fall back to the backend pool
    }
  }
  for (const k of envKeyPool()) if (!keys.includes(k)) keys.push(k);
  return keys;
};

/** Back-compat: first available key. */
const resolveOpenRouterKey = async (userId) => (await getOpenRouterKeys(userId))[0];

/**
 * Build the ordered model list for a request:
 *   OPENROUTER_MODEL (override) || the caller's model,
 *   then OPENROUTER_FALLBACK_MODELS, then any opts.fallbackModels.
 */
const buildModelList = (callerModel, optFallbacks = []) => {
  const primary = process.env.OPENROUTER_MODEL || callerModel;
  const envFallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...envFallbacks, ...optFallbacks].filter(Boolean))];
};

/**
 * Run a chat completion with automatic fallback: for each model, try every key
 * in order, rotating on rate-limit / out-of-credits / 5xx; move to the next
 * model when all keys are exhausted for the current one.
 */
const completeWithFallback = async (keys, params, opts = {}) => {
  if (!keys.length) {
    throw new Error(
      "No OpenRouter API key configured (set OPENROUTER_API_KEY or OPENROUTER_API_KEYS)."
    );
  }
  const models = buildModelList(params.model, opts.fallbackModels);
  const timeout = opts.timeout ?? 60000;
  let lastErr;

  for (const model of models) {
    for (let i = 0; i < keys.length; i++) {
      const client = new OpenAI({ baseURL: OPENROUTER_BASE_URL, apiKey: keys[i], timeout });
      try {
        return await client.chat.completions.create({ ...params, model });
      } catch (err) {
        lastErr = err;
        const status = err?.status ?? err?.response?.status;
        if (!ROTATE_ON.has(status)) throw err; // genuine error — don't burn the pool
        console.warn(
          `⚠️ OpenRouter key ${i + 1}/${keys.length} failed for ${model} (status ${status}); trying next…`
        );
      }
    }
    if (models.length > 1) console.warn(`⚠️ All keys exhausted for ${model}; trying next model…`);
  }
  throw lastErr;
};

/**
 * Returns a minimal OpenRouter client whose `chat.completions.create` rotates
 * across the key pool + fallback models. Drop-in for the previous real client
 * (services only use chat.completions.create). Keys are resolved once here.
 * @param {string|undefined} userId
 * @param {{timeout?:number, fallbackModels?:string[]}} [opts]
 */
const getOpenRouterClient = async (userId, opts = {}) => {
  const keys = await getOpenRouterKeys(userId);
  return {
    chat: {
      completions: {
        create: (params) => completeWithFallback(keys, params, opts),
      },
    },
  };
};

/** Convenience one-shot used by callers that don't hold a client. */
const createChatCompletion = async (userId, params, opts = {}) => {
  const keys = await getOpenRouterKeys(userId);
  return completeWithFallback(keys, params, opts);
};

module.exports = {
  OPENROUTER_BASE_URL,
  getOpenRouterKeys,
  resolveOpenRouterKey,
  getOpenRouterClient,
  createChatCompletion,
};
