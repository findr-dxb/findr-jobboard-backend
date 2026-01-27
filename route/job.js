const express = require("express");
const router = express.Router();
const {
  createJob,
  updateJob,
  getJobs,
  getJob,
  closeJob,
  publishJob,
  getEmployerJobs,
  getJobRecommendations
} = require("../controller/JobController");
const authMiddleware = require("../middleware/auth");

// Public routes
router.get("/jobs", getJobs); // Get all jobs (with filters)
// router.get("/jobs/:jobId", getJob); // Get a single job

// Protected routes (require authentication)
router.get("/employer/jobs", authMiddleware, getEmployerJobs); // Get employer's own jobs
router.get("/jobs/recommendations", authMiddleware, getJobRecommendations); // Get job recommendations for user

// Public route with dynamic parameter (must be after specific routes)
router.get("/jobs/:jobId", getJob); // Get a single job
router.post("/create/jobs", authMiddleware, createJob); // Create a new job
router.put("/jobs/:jobId", authMiddleware, updateJob); // Update a job
router.put("/jobs/:jobId/close", authMiddleware, closeJob); // Close a job
router.put("/jobs/:jobId/publish", authMiddleware, publishJob); // Publish a job

module.exports = router;

