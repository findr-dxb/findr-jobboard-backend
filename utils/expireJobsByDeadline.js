const Job = require("../model/JobSchema");

/** Start of UTC calendar day for a date (used to compare deadline vs "today"). */
function utcStartOfDay(d = new Date()) {
  const x = new Date(d);
  return new Date(
    Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 0, 0, 0, 0)
  );
}

/**
 * Validates applicationDeadline is a real date, not in the past,
 * and not more than 1 calendar month from today.
 */
function validateApplicationDeadline(deadlineValue) {
  if (deadlineValue === undefined || deadlineValue === null || deadlineValue === "") {
    return { valid: false, message: "Application deadline is required." };
  }

  const parsed = new Date(deadlineValue);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, message: "Please provide a valid application deadline." };
  }

  const deadlineDay = utcStartOfDay(parsed);
  const todayStart = utcStartOfDay(new Date());

  if (deadlineDay < todayStart) {
    return { valid: false, message: "Application deadline cannot be in the past." };
  }

  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 1);
  const maxDay = utcStartOfDay(maxDate);

  if (deadlineDay > maxDay) {
    return {
      valid: false,
      message: "Application deadline cannot be more than 1 month from today.",
    };
  }

  return { valid: true, deadline: parsed };
}

/**
 * Active jobs whose application deadline is before the start of the current UTC day
 * are set to status "expired" (deadline day is still valid; next day applications close).
 */
async function expireJobsPastApplicationDeadline() {
  const todayStart = utcStartOfDay(new Date());
  const now = new Date();
  const result = await Job.updateMany(
    {
      status: "active",
      $or: [
        { applicationDeadline: { $lt: todayStart } },
        { expiredDate: { $lte: now } }
      ]
    },
    { $set: { status: "expired" } }
  );
  return result;
}

module.exports = {
  utcStartOfDay,
  validateApplicationDeadline,
  expireJobsPastApplicationDeadline,
};
