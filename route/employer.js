const express = require("express");
const router = express.Router();
const { 
  getEmployerProfileDetails,
  updateEmployerProfile,
  getEmployerDashboardStats,
  updateSubscription,
  updateHRServices,
  updateNotificationPreferences,
  getPublicCompanyProfile,
  createOrUpdateEmployerReview,
  getEmployerReviewByApplication,
  getAllEmployerReviews,
  deleteEmployerReview,
  checkEmployerEligibility
} = require("../controller/SaveEmployerProfile");
const authMiddleware = require("../middleware/auth");

// Profile routes (protected)
router.get("/employer/details", authMiddleware, getEmployerProfileDetails);
router.put("/employer/update", authMiddleware, updateEmployerProfile);
router.get("/employer/eligibility", authMiddleware, checkEmployerEligibility);

// Public company profile (no auth required)
router.get("/company/:employerId", getPublicCompanyProfile);

// Dashboard routes
router.get("/employer/dashboard/stats", authMiddleware, getEmployerDashboardStats);

// Subscription management
router.put("/employer/subscription", authMiddleware, updateSubscription);

// HR Services management
router.put("/employer/hr-services", authMiddleware, updateHRServices);

// Notification preferences
router.put("/employer/notifications", authMiddleware, updateNotificationPreferences);

// Review routes (protected)
router.post("/employer/reviews", authMiddleware, createOrUpdateEmployerReview);
router.get("/employer/reviews/application/:applicationId", authMiddleware, getEmployerReviewByApplication);
router.get("/employer/reviews", authMiddleware, getAllEmployerReviews);
router.delete("/employer/reviews/:reviewId", authMiddleware, deleteEmployerReview);

module.exports = router;
