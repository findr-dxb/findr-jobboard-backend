const express = require("express");
const router = express.Router();
const { 
  createApplication, 
  getEmployerApplications, 
  getJobApplications,
  updateApplicationStatus,
  rateApplicant,
  getEmployerDashboard,
  getUserApplications,
  getApplicationById,
  getJobSeekerInterviews,
  getEmployerInterviews,
  createReferralApplication,
  getUserReferralHistory,
  withdrawApplication
} = require("../controller/ApplicationController");
const authMiddleware = require("../middleware/auth");

// Create application (job seeker applies)
router.post("/applications", authMiddleware, createApplication);

// Create referral application (User A refers User B)
router.post("/applications/referral", authMiddleware, createReferralApplication);

// Get job seeker's applications
router.get("/applications/user", authMiddleware, getUserApplications);

// Get user's referral history
router.get("/applications/referrals/history", authMiddleware, getUserReferralHistory);

// Get all applications for employer
router.get("/applications/employer", authMiddleware, getEmployerApplications);

// Get applications for specific job
router.get("/applications/job/:jobId", authMiddleware, getJobApplications);

// Get single application by ID
router.get("/applications/:applicationId", authMiddleware, getApplicationById);

// Withdraw application (job seeker withdraws their own application)
router.delete("/applications/:applicationId", authMiddleware, withdrawApplication);

// Update application status
router.patch("/applications/:applicationId/status", authMiddleware, updateApplicationStatus);

// Rate applicant
router.patch("/applications/:applicationId/rate", authMiddleware, rateApplicant);

// Get employer dashboard data
router.get("/applications/dashboard", authMiddleware, getEmployerDashboard);

// Get interviews for job seeker
router.get("/interviews/jobseeker", authMiddleware, getJobSeekerInterviews);

// Get interviews for employer
router.get("/interviews/employer", authMiddleware, getEmployerInterviews);

// Debug: Get all applications for current employer
router.get("/applications/debug", authMiddleware, async (req, res) => {
  try {
    const employerId = req.user.id;
    const Application = require("../model/ApplicationSchema");
    const Job = require("../model/JobSchema");
    
    console.log('Debug: Looking for applications for employer:', employerId);
    
    // First, check jobs by this employer
    const jobs = await Job.find({ employer: employerId }).select('_id title');
    console.log('Debug: Found jobs:', jobs.length);
    
    // Then check applications
    const applications = await Application.find({ employerId })
      .select('_id status appliedDate jobId applicantId')
      .populate('jobId', 'title')
      .populate('applicantId', 'name email')
      .limit(10);
    
    console.log('Debug: Found applications:', applications.length);
    
    res.json({
      message: "Debug: Found applications",
      employerId: employerId,
      jobsCount: jobs.length,
      jobs: jobs,
      applicationsCount: applications.length,
      applications: applications
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
