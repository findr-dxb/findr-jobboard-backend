/**
 * Weighted jobseeker profile completion (total 100%).
 * Keep in sync with Techno-frontend--main/lib/jobseeker-profile-completion.ts
 */

function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function sectionScore(checks, weight, missingLabel) {
  if (!checks.length) return { score: 0, missing: [] };
  const filled = checks.filter((c) => c.ok).length;
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const score = (filled / checks.length) * weight;
  return { score, missing: missing.length ? [`${missingLabel}: ${missing.join(", ")}`] : [] };
}

function hasResume(user) {
  return (
    isFilled(user.resumeDocument) ||
    isFilled(user.resumeUrl) ||
    isFilled(user.resume) ||
    (user.jobPreferences?.resumeAndDocs && user.jobPreferences.resumeAndDocs.length > 0)
  );
}

function hasAdditionalDocuments(user) {
  const docs = user.jobPreferences?.resumeAndDocs || [];
  const hasExtraDocs =
    docs.length > 0 ||
    (Array.isArray(user.documents) && user.documents.length > 0);
  const hasCertifications =
    (Array.isArray(user.certifications) && user.certifications.length > 0) ||
    (typeof user.certifications === "string" && user.certifications.trim() !== "");
  return hasExtraDocs || hasCertifications;
}

function isNonEmirati(nationality) {
  if (!nationality) return false;
  const n = nationality.toLowerCase();
  return !n.includes("emirati");
}

/**
 * @param {object} user - FindrUser document or API-shaped profile object
 * @returns {{ percentage: number, missingFields: string[], hasResume: boolean, canApply: boolean, breakdown: object }}
 */
function calculateJobseekerProfileCompletion(user) {
  const missingFields = [];
  let percentage = 0;

  const nationality = user.nationality || "";
  const personalChecks = [
    { label: "Full Name", ok: isFilled(user.fullName || user.name) },
    { label: "Email", ok: isFilled(user.email) },
    { label: "Phone Number", ok: isFilled(user.phoneNumber) },
    { label: "Location", ok: isFilled(user.location) },
    { label: "Date of Birth", ok: isFilled(user.dateOfBirth) },
    { label: "Nationality", ok: isFilled(user.nationality) },
    { label: "Emirates ID", ok: isFilled(user.emirateId) },
    { label: "Passport Number", ok: isFilled(user.passportNumber) },
    { label: "Professional Summary", ok: isFilled(user.professionalSummary) },
  ];
  if (isNonEmirati(nationality)) {
    personalChecks.push({
      label: "Visa Expiry Date",
      ok: isFilled(user.visaExpiryDate),
    });
  }

  const personal = sectionScore(personalChecks, 25, "Personal Information");
  percentage += personal.score;
  missingFields.push(...personal.missing);

  if (isFilled(user.profilePicture)) {
    percentage += 10;
  } else {
    missingFields.push("Profile Picture");
  }

  const exp = user.professionalExperience?.[0] || {};
  const professional = sectionScore(
    [
      { label: "Current Role", ok: isFilled(exp.currentRole) },
      { label: "Company", ok: isFilled(exp.company) },
      { label: "Years of Experience", ok: isFilled(exp.yearsOfExperience) },
      { label: "Industry", ok: isFilled(exp.industry) },
      {
        label: "Current Salary",
        ok: isFilled(user.jobPreferences?.salaryExpectation),
      },
    ],
    15,
    "Professional Information"
  );
  percentage += professional.score;
  missingFields.push(...professional.missing);

  const edu = user.education?.[0] || {};
  const education = sectionScore(
    [
      { label: "Highest Degree", ok: isFilled(edu.highestDegree) },
      { label: "Institution", ok: isFilled(edu.institution) },
      { label: "Year of Graduation", ok: isFilled(edu.yearOfGraduation) },
      { label: "Grade/CGPA", ok: isFilled(edu.gradeCgpa) },
    ],
    10,
    "Education"
  );
  percentage += education.score;
  missingFields.push(...education.missing);

  if (hasResume(user)) {
    percentage += 10;
  } else {
    missingFields.push("Resume Upload");
  }

  if (hasAdditionalDocuments(user)) {
    percentage += 5;
  } else {
    missingFields.push("Additional Documents");
  }

  if (isFilled(user.introVideo)) {
    percentage += 5;
  } else {
    missingFields.push("Introductory Video");
  }

  const social = user.socialLinks || {};
  if (isFilled(social.linkedIn || social.linkedin)) percentage += 4;
  else missingFields.push("LinkedIn URL");
  if (isFilled(social.instagram)) percentage += 4;
  else missingFields.push("Instagram URL");
  if (isFilled(social.twitterX || social.twitter)) percentage += 2;
  else missingFields.push("Twitter URL");

  const skillsOk =
    (Array.isArray(user.skills) && user.skills.length > 0) ||
    (typeof user.skills === "string" && user.skills.trim() !== "");
  if (skillsOk) percentage += 5;
  else missingFields.push("Skills");

  const prefs = user.jobPreferences || {};
  const preferredJobType = prefs.preferredJobType;
  const jobTypeOk = Array.isArray(preferredJobType)
    ? preferredJobType.length > 0
    : isFilled(preferredJobType);

  const prefChecks = [
    { label: "Preferred Job Type", ok: jobTypeOk },
    { label: "Preferred Location", ok: isFilled(prefs.preferredLocation) },
    { label: "Availability", ok: isFilled(prefs.availability) }
  ];

  const prefScore = sectionScore(prefChecks, 5, "Job Preferences");
  percentage += prefScore.score;
  missingFields.push(...prefScore.missing);

  const rounded = Math.min(Math.round(percentage), 100);
  const resume = hasResume(user);

  return {
    percentage: rounded,
    missingFields,
    hasResume: resume,
    canApply: rounded >= 80 && resume,
    profilePoints: 50 + rounded * 2,
  };
}

module.exports = {
  calculateJobseekerProfileCompletion,
  hasResume,
};
