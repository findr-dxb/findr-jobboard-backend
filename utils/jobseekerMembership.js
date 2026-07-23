/**
 * Jobseeker membership: Prime / Plus / Pro / Elite / Icon
 * Keep in sync with Techno-frontend--main/lib/jobseeker-membership.ts
 */

const MEMBERSHIP_TIERS = ["Prime", "Plus", "Pro", "Elite", "Icon"];

function parseSalary(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isEmiratiNationality(nationality) {
  if (!nationality) return false;
  return String(nationality).toLowerCase().includes("emirati");
}

/**
 * Assign membership from nationality + salary expectation.
 * Icon = Emirati only (any salary).
 * Else: Prime ≤7k, Plus ≤15k, Pro ≤25k, Elite >25k.
 */
function determineJobseekerMembership({ nationality, salaryExpectation } = {}) {
  if (isEmiratiNationality(nationality)) return "Icon";

  const salary = parseSalary(salaryExpectation);
  if (salary === null) return "Prime";
  if (salary <= 7000) return "Prime";
  if (salary <= 15000) return "Plus";
  if (salary <= 25000) return "Pro";
  return "Elite";
}

function determineJobseekerMembershipFromUser(user = {}) {
  return determineJobseekerMembership({
    nationality: user.nationality,
    salaryExpectation: user.jobPreferences?.salaryExpectation,
  });
}

/** Only Icon (Emirati) gets 2x; all others 1x. */
function getMembershipMultiplier(tier) {
  return tier === "Icon" ? 2 : 1;
}

module.exports = {
  MEMBERSHIP_TIERS,
  parseSalary,
  isEmiratiNationality,
  determineJobseekerMembership,
  determineJobseekerMembershipFromUser,
  getMembershipMultiplier,
};
