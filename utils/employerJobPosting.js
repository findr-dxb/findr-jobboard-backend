const Job = require("../model/JobSchema");

const COOLDOWN_DAYS = 15;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function endOfUtcDay(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function isPostingGrantActive(employer) {
  if (!employer?.jobPostingGrantExpiresAt) return false;
  return new Date(employer.jobPostingGrantExpiresAt) > new Date();
}

async function expireEmployerPostingGrantIfNeeded(employer) {
  if (!employer?.jobPostingGrantExpiresAt) return employer;

  const expiresAt = new Date(employer.jobPostingGrantExpiresAt);
  if (expiresAt > new Date()) return employer;

  const grantStartedAt = employer.jobPostingGrantedAt
    ? new Date(employer.jobPostingGrantedAt)
    : null;

  if (grantStartedAt) {
    await Job.updateMany(
      {
        employer: employer._id,
        status: "active",
        createdAt: { $gte: grantStartedAt, $lte: expiresAt },
      },
      { $set: { status: "expired", expiredDate: new Date() } }
    );
  }

  employer.jobPostingLimit = 0;
  employer.jobPostingGrantExpiresAt = null;
  employer.jobPostingGrantedAt = null;
  await employer.save();

  return employer;
}

function getEffectiveJobPostingLimit(employer) {
  if (employer.jobPostingGrantExpiresAt) {
    const expiresAt = new Date(employer.jobPostingGrantExpiresAt);
    if (expiresAt <= new Date()) {
      return 0;
    }
  }

  if (employer.jobPostingLimit != null && employer.jobPostingLimit !== undefined) {
    return employer.jobPostingLimit;
  }
  // Legacy accounts: one slot until they post and tracking begins
  return employer.lastJobPostedAt ? 0 : 1;
}

function getNextFreeSlotAt(lastJobPostedAt) {
  if (!lastJobPostedAt) return null;
  return new Date(new Date(lastJobPostedAt).getTime() + COOLDOWN_MS);
}

function isFreeCooldownElapsed(lastJobPostedAt) {
  const next = getNextFreeSlotAt(lastJobPostedAt);
  return next ? new Date() >= next : false;
}

/** Sync cooldown restore and expire admin posting grants when past deadline. */
async function syncEmployerJobPostingLimit(employer) {
  if (!employer) return employer;

  employer = await expireEmployerPostingGrantIfNeeded(employer);

  const limit = getEffectiveJobPostingLimit(employer);
  if (limit > 0) {
    if (employer.jobPostingLimit == null) {
      employer.jobPostingLimit = limit;
      await employer.save();
    }
    return employer;
  }

  if (
    !isPostingGrantActive(employer) &&
    employer.lastJobPostedAt &&
    isFreeCooldownElapsed(employer.lastJobPostedAt)
  ) {
    employer.jobPostingLimit = 1;
    await employer.save();
  }

  return employer;
}

function getJobPostingStatus(employer) {
  const pointsCost = employer.jobPostingPoints ?? 100;
  const limit = getEffectiveJobPostingLimit(employer);
  const employerPoints = employer.points ?? 0;
  const nextFreeSlotAt =
    limit === 0 && employer.lastJobPostedAt
      ? getNextFreeSlotAt(employer.lastJobPostedAt)
      : null;

  const msUntilFree = nextFreeSlotAt
    ? Math.max(0, nextFreeSlotAt.getTime() - Date.now())
    : 0;
  const daysUntilFreeSlot =
    limit > 0 ? 0 : Math.ceil(msUntilFree / (24 * 60 * 60 * 1000));

  const hasPostingSlot = limit > 0;
  const canUnlockWithPoints =
    !hasPostingSlot && employerPoints >= pointsCost;

  const grantExpiresAt = employer.jobPostingGrantExpiresAt || null;
  const grantActive = grantExpiresAt
    ? new Date(grantExpiresAt) > new Date()
    : false;

  return {
    limit,
    pointsCost,
    employerPoints,
    lastJobPostedAt: employer.lastJobPostedAt || null,
    nextFreeSlotAt,
    daysUntilFreeSlot,
    cooldownDays: COOLDOWN_DAYS,
    hasPostingSlot,
    canUnlockWithPoints,
    waitRequired: !hasPostingSlot && daysUntilFreeSlot > 0 && !canUnlockWithPoints,
    grantExpiresAt,
    grantActive,
    grantedAt: employer.jobPostingGrantedAt || null,
  };
}

function hasJobPostingSlot(employer) {
  return getEffectiveJobPostingLimit(employer) > 0;
}

module.exports = {
  COOLDOWN_DAYS,
  COOLDOWN_MS,
  endOfUtcDay,
  syncEmployerJobPostingLimit,
  expireEmployerPostingGrantIfNeeded,
  getJobPostingStatus,
  hasJobPostingSlot,
  isFreeCooldownElapsed,
  getEffectiveJobPostingLimit,
  isPostingGrantActive,
};
