const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const {
  createAdmin,
  adminLogin,
  getAdmins,
  deleteAdmin,
  getUsers,
  getDashboardStats,
  getDashboardAnalytics,
  getNationalityDemographics,
  getIndustryDistribution,
  getRecentLogins,
  getSignupsToday,
  getActiveUsersToday,
  getActiveUsersTodayList,
  getJobs,
  getApplications,
  updateApplicationScreening,
  updateJobStatus,
  deleteJob,
  getJobDetails,
  getQuotes,
  updateQuote,
  getJobseekerById,
  getEmployerById,
  updateUserStatus,
  getUserProfile,
  getServices,
  updateService,
  getGrievances,
  getGrievance,
  getRmPostingRequests,
  provideRmPosting,
  getFindrStarsAdmin,
  createFindrStarAdmin,
  deleteFindrStarAdmin,
  getSidebarBadges,
  getFilterSearchJobseekers
} = require("../controller/AdminController");

router.post("/admin/login", adminLogin);
router.use(authMiddleware);
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.type === "admin" || req.user.role === "superadmin")) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied. Admin role required." });
};
router.use(adminOnly);

router.post("/admin/create-admin", createAdmin);

// List all admins
router.get("/admin/admins", getAdmins);

// Delete an admin by id
router.delete("/admin/admins/:id", deleteAdmin);

// Admin Users Endpoint - Get users by type
router.get("/admin/users/:userType", getUsers);

// Admin Users Advanced Search
router.get("/admin/users-search", getFilterSearchJobseekers);

router.get("/admin/dashboard/stats", getDashboardStats);
router.get("/admin/dashboard/nationality", getNationalityDemographics);
router.get("/admin/dashboard/industry", getIndustryDistribution);
router.get("/admin/dashboard/recent-logins", getRecentLogins);
router.get("/admin/dashboard/signups-today", getSignupsToday);
router.get("/admin/dashboard/active-users-today", getActiveUsersToday);
router.get("/admin/dashboard/active-users-today/list", getActiveUsersTodayList);
router.get("/admin/dashboard/analytics", getDashboardAnalytics);
router.get("/admin/sidebar-badges", getSidebarBadges);

// Admin Jobs Endpoint - Get all active jobs
router.get("/admin/jobs", getJobs);

// Admin Applications Endpoint - Get all applications
router.get("/admin/applications", getApplications);

// Admin screening: Move to Pipeline / Hold / Reject
router.patch("/admin/applications/:applicationId/status", updateApplicationScreening);

// Admin Job Actions Endpoint - Update job status
router.patch("/admin/jobs/:jobId/status", updateJobStatus);

// Admin Delete Job Endpoint
router.delete("/admin/jobs/:jobId", deleteJob);

// Admin Get Individual Job Details
router.get("/admin/jobs/:jobId", getJobDetails);

// Admin Quotes Endpoint - Get all quote requests
router.get("/admin/quotes", getQuotes);

// Admin Quote Actions Endpoint - Update quote status
router.put("/admin/quotes/:quoteId", updateQuote);

// Get individual jobseeker by ID
router.get("/admin/users/jobseeker/:id", getJobseekerById);

// Get individual employer by ID
router.get("/admin/users/employer/:id", getEmployerById);

// Block/Unblock user endpoint
router.patch("/admin/users/:userId/status", updateUserStatus);

// Get user profile for admin "Know More" functionality
router.get("/admin/users/:userType/:id/profile", getUserProfile);

// Admin Services Endpoint - Get all services with pagination and filtering
router.get("/admin/services", getServices);

// Admin Service Management - Stop/Resume Services
router.put("/admin/service-management/:serviceId", updateService);

// Admin Get Grievances
router.get("/admin/grievances", getGrievances);

// Admin Get Grievance by ID
router.get("/admin/grievances/:id", getGrievance);

router.get("/admin/rm-posting-requests", getRmPostingRequests);
router.post("/admin/rm-posting-requests/:id/provide-posting", provideRmPosting);

// Admin Findr Stars Management
router.get("/admin/stars", getFindrStarsAdmin);
router.post("/admin/stars", createFindrStarAdmin);
router.delete("/admin/stars/:id", deleteFindrStarAdmin);

module.exports = router;
