/**
 * Stale-run reaper. Workflow runs that never reach a terminal state (process
 * restart, crash, etc.) would otherwise sit in "running" forever. This sweeps
 * them to "failed" so the UI/reports stay accurate. No Redis required.
 */
const Report = require("../models/Report");

const STALE_MINUTES = parseInt(process.env.STALE_RUN_MINUTES || "30", 10);
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

async function reapStaleReports() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const res = await Report.updateMany(
    { status: "running", startTime: { $lt: cutoff } },
    {
      $set: { status: "failed", endTime: new Date() },
      $push: {
        executionErrors: {
          message: `Run exceeded ${STALE_MINUTES} min without finishing and was auto-closed.`,
          timestamp: new Date(),
        },
      },
    }
  );
  if (res.modifiedCount) {
    console.log(`[reaper] auto-closed ${res.modifiedCount} stale running report(s)`);
  }
  return res.modifiedCount || 0;
}

function startReaper() {
  reapStaleReports().catch((e) => console.error("[reaper]", e.message));
  const timer = setInterval(
    () => reapStaleReports().catch((e) => console.error("[reaper]", e.message)),
    SWEEP_INTERVAL_MS
  );
  timer.unref?.();
  console.log(`[reaper] started (closes runs idle > ${STALE_MINUTES} min)`);
  return timer;
}

module.exports = { startReaper, reapStaleReports };
