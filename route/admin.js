const express = require("express");
const router = express.Router();
const {
  createAdmin,
  adminLogin,
  getAdmins,
  deleteAdmin,
  getUsers,
  getDashboardStats,
  getDashboardAnalytics,
  getJobs,
  getApplications,
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
  getFindrStarsAdmin,
  createFindrStarAdmin,
  deleteFindrStarAdmin
} = require("../controller/AdminController");

// Create Admin Account
router.post("/admin/create-admin", createAdmin);

// Admin Login
router.post("/admin/login", adminLogin);

// List all admins
router.get("/admin/admins", getAdmins);

// Delete an admin by id
router.delete("/admin/admins/:id", deleteAdmin);

// Admin Users Endpoint - Get users by type
router.get("/admin/users/:userType", getUsers);

// Admin Dashboard Statistics Endpoint
router.get("/admin/dashboard/stats", getDashboardStats);

// Additional endpoint for detailed analytics (optional)
router.get("/admin/dashboard/analytics", getDashboardAnalytics);

// Admin Jobs Endpoint - Get all active jobs
router.get("/admin/jobs", getJobs);

// Admin Applications Endpoint - Get all applications
router.get("/admin/applications", getApplications);

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

// Admin Findr Stars Management
router.get("/admin/stars", getFindrStarsAdmin);
router.post("/admin/stars", createFindrStarAdmin);
router.delete("/admin/stars/:id", deleteFindrStarAdmin);

module.exports = router;
