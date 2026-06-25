/**
 * Optional Redis layer. Everything degrades gracefully when REDIS_URL is unset
 * (local dev with no Redis) — callers must handle a null client / false flag.
 */
const IORedis = require("ioredis");

// Read lazily — this module is required before dotenv.config() runs in app.js,
// so capturing process.env.REDIS_URL at module-load time would always be empty.
const redisUrl = () => process.env.REDIS_URL || "";
const redisEnabled = () => !!redisUrl();

/** Create a fresh connection (BullMQ / pub-sub need their own). */
function createRedis(extra = {}) {
  const url = redisUrl();
  if (!url) return null;
  const client = new IORedis(url, { maxRetriesPerRequest: null, ...extra });
  client.on("error", (e) => console.error("[redis] error:", e.message));
  return client;
}

let shared = null;
/** Shared connection for caching / generic commands. */
function getRedis() {
  if (!redisUrl()) return null;
  if (!shared) {
    shared = createRedis();
    shared.on("connect", () => console.log("[redis] connected"));
  }
  return shared;
}

module.exports = { redisUrl, redisEnabled, createRedis, getRedis };
