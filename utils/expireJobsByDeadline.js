const Job = require("../model/JobSchema");

/** Start of UTC calendar day for a date (used to compare deadline vs "today"). */
function utcStartOfDay(d = new Date()) {
  const x = new Date(d);
  return new Date(
    Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 0, 0, 0, 0)
  );
}

/**
 * Active jobs whose application deadline is before the start of the current UTC day
 * are set to status "expired" (deadline day is still valid; next day applications close).
 */
async function expireJobsPastApplicationDeadline() {
  const todayStart = utcStartOfDay(new Date());
  const result = await Job.updateMany(
    {
      status: "active",
      applicationDeadline: { $lt: todayStart },
    },
    { $set: { status: "expired" } }
  );
  return result;
}

module.exports = {
  utcStartOfDay,
  expireJobsPastApplicationDeadline,
};
