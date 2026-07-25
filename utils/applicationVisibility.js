/** Statuses used while admin screens an application before the employer sees it. */
const ADMIN_SCREENING_STATUSES = ["admin_review", "admin_hold", "admin_rejected"];

/** Statuses hidden from employer lists/counts (screening + withdrawn). */
const EMPLOYER_HIDDEN_STATUSES = [...ADMIN_SCREENING_STATUSES, "withdrawn"];

function isAdminScreeningStatus(status) {
  return ADMIN_SCREENING_STATUSES.includes(status);
}

function isEmployerVisibleStatus(status) {
  return !EMPLOYER_HIDDEN_STATUSES.includes(status);
}

/** Mongo filter for employer-facing application queries. */
function employerVisibleQuery(extra = {}) {
  const { status, ...rest } = extra;
  if (status) {
    if (EMPLOYER_HIDDEN_STATUSES.includes(status)) {
      return { ...rest, _id: null }; // match nothing
    }
    return { ...rest, status };
  }
  return { ...rest, status: { $nin: EMPLOYER_HIDDEN_STATUSES } };
}

module.exports = {
  ADMIN_SCREENING_STATUSES,
  EMPLOYER_HIDDEN_STATUSES,
  isAdminScreeningStatus,
  isEmployerVisibleStatus,
  employerVisibleQuery,
};
