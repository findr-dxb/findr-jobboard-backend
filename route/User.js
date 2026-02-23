const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  updateProfile,
  getUserProfileDetails,
  checkProfileEligibility,
  forgotPassword,
  validateResetToken,
  resetPassword,
  followSocialMedia,
  testEmailConfig,
  searchUserByIdentifier,
  getReferralJoiners,
  getReferralJoinerProfile,
  requestProfileAccess,
  confirmProfileAccess,
} = require("../controller/Auth");
const authMiddleware = require("../middleware/auth");

// Auth routes
router.post("/signup", signup);
router.post("/login", login);

// Password reset routes
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/validate-reset-token", validateResetToken);
router.post("/auth/reset-password", resetPassword);

// Email configuration test endpoint (for debugging)
router.get("/auth/test-email-config", testEmailConfig);

// Profile routes (protected)
router.put("/profile/update", authMiddleware, updateProfile);
router.get("/profile/details", authMiddleware, getUserProfileDetails);
router.get("/profile/eligibility", authMiddleware, checkProfileEligibility);
router.post("/profile/follow-social", authMiddleware, followSocialMedia);

// User lookup route (protected)
router.get("/users/lookup", authMiddleware, searchUserByIdentifier);

// Users who joined using current user's referral code (protected)
router.get("/referrals/joiners", authMiddleware, getReferralJoiners);
router.get("/referrals/joiners/:id", authMiddleware, getReferralJoinerProfile);
router.post("/profile-access/request", authMiddleware, requestProfileAccess);
router.get("/profile-access/confirm", confirmProfileAccess);

module.exports = router;
