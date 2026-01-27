const mongoose = require("mongoose");
const Application = require("../model/ApplicationSchema");
const Job = require("../model/JobSchema");
const Employer = require("../model/EmployerSchema");
const User = require("../model/UserSchemas");

// Helper function to recalculate awaitingFeedback count for a user
const recalculateAwaitingFeedback = async (userId) => {
  try {
    const viewedApplicationsCount = await Application.countDocuments({
      applicantId: userId,
      viewedByEmployer: true,
      status: { $nin: ['withdrawn'] }
    });

    const totalApplicationsCount = await Application.countDocuments({
      applicantId: userId,
      status: { $nin: ['withdrawn'] }
    });

    const awaitingFeedback = Math.max(totalApplicationsCount - viewedApplicationsCount, 0);

    await User.findByIdAndUpdate(userId, {
      $set: { 'applications.awaitingFeedback': awaitingFeedback }
    });

    return awaitingFeedback;
  } catch (error) {
    console.error('Error recalculating awaitingFeedback:', error);
    return 0;
  }
};

// Create new application (when user applies to job)
// exports.createApplication = async (req, res) => {
//   try {
//     const { jobId, expectedSalary, availability, coverLetter } = req.body;
//     const applicantId = req.user.id;

//     // Check if job exists and is active
//     const job = await Job.findById(jobId);
//     if (!job) {
//       return res.status(404).json({ message: "Job not found" });
//     }
//     if (job.status !== "active") {
//       return res.status(400).json({ message: "Job is not accepting applications" });
//     }

//     // Check if user already applied
//     const existingApplication = await Application.findOne({ jobId, applicantId });
//     if (existingApplication) {
//       return res.status(400).json({ message: "You have already applied to this job" });
//     }

//     // Get applicant details for email (do before response)
//     const applicant = await User.findById(applicantId).select('email fullName name');
//     if (!applicant) {
//       return res.status(404).json({ message: "Applicant not found" });
//     }

//     // Create application
//     const application = new Application({
//       jobId,
//       applicantId,
//       employerId: job.employer,
//       expectedSalary,
//       availability,
//       coverLetter,
//       resume: req.body.resume || "", // Should be file URL from upload
//     });

//     await application.save();

//     // Update job applications array
//     await Job.findByIdAndUpdate(jobId, {
//       $push: { applications: application._id }
//     });

//     // Update employer applications array
//     await Employer.findByIdAndUpdate(job.employer, {
//       $push: { applications: application._id }
//     });

//     // Update user's applied jobs and award points for applying
//     await User.findByIdAndUpdate(applicantId, {
//       $push: { 
//         "applications.appliedJobs": {
//           jobId,
//           role: job.title,
//           company: job.companyName,
//           date: new Date()
//         }
//       },
//       $inc: { 
//         "applications.totalApplications": 1,
//         "applications.activeApplications": 1,
//         "rewards.applyForJobs": 20, // Award 20 points for applying to a job
//         "rewards.totalPoints": 20   // Add to total points
//       }
//     });

//     // Send HTTP response FIRST
//     res.status(201).json({
//       message: "Application submitted successfully",
//       data: application,
//       pointsAwarded: 20
//     });

//     // Fire-and-forget emails AFTER response
//     setImmediate(async () => {
//       try {
//         const { sendNewApplicationNotificationEmail, sendApplicationConfirmationEmail } = require('../services/emailService');
//         const employer = await Employer.findById(job.employer).select('companyName companyEmail email contactEmail name');
//         const employerEmail = employer?.companyEmail || employer?.email || employer?.contactEmail;
//         const employerName = employer?.name || employer?.companyName || 'Employer';
//         const applicantName = applicant.fullName || applicant.name || 'Candidate';
//         console.log('[ApplicationEmail] Triggering emails', {
//           employerEmail,
//           applicantEmail: applicant?.email,
//           applicantName,
//           jobTitle: job.title
//         });
//         if (employerEmail) {
//           const employerEmailResult = await sendNewApplicationNotificationEmail(
//             employerEmail,
//             employerName,
//             job.title,
//             applicantName,
//             application.appliedDate || new Date()
//           );
//           if (employerEmailResult?.success) {
//             console.log('[ApplicationEmail] Employer notification sent', { messageId: employerEmailResult.messageId, employerEmail });
//           } else {
//             console.error('[ApplicationEmail] Employer notification failed', { error: employerEmailResult?.error, employerEmail });
//           }
//         }
//         if (applicant?.email) {
//           const applicantEmailResult = await sendApplicationConfirmationEmail(
//             applicant.email,
//             applicantName,
//             job.title,
//             job.companyName || 'Company',
//             application.appliedDate || new Date()
//           );
//           if (applicantEmailResult?.success) {
//             console.log('[ApplicationEmail] Applicant confirmation sent', { messageId: applicantEmailResult.messageId, applicantEmail: applicant.email });
//           } else {
//             console.error('[ApplicationEmail] Applicant confirmation failed', { error: applicantEmailResult?.error, applicantEmail: applicant.email });
//           }
//         }
//       } catch (err) {
//         console.error('Post-response email error (createApplication):', err);
//       }
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ 
//       message: "Failed to submit application", 
//       error: error.message 
//     });
//   }
// };
// Create new application (when user applies to job)
exports.createApplication = async (req, res) => {
  try {
    const { jobId, expectedSalary, availability, coverLetter } = req.body;
    const applicantId = req.user.id;

    // Check if job exists and is active
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status !== "active") {
      return res.status(400).json({ message: "Job is not accepting applications" });
    }

    // Check if user already applied (excluding withdrawn applications - allow re-applying after withdrawal)
    const existingApplication = await Application.findOne({ 
      jobId, 
      applicantId, 
      status: { $ne: 'withdrawn' } 
    });
    if (existingApplication) {
      return res.status(400).json({ message: "You have already applied to this job" });
    }

    // Check if there's a withdrawn application for this job (for re-application)
    const withdrawnApplication = await Application.findOne({ 
      jobId, 
      applicantId, 
      status: 'withdrawn' 
    });

    // Get applicant details
    const applicant = await User.findById(applicantId).select('email fullName name');
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    let application;
    
    if (withdrawnApplication) {
      // Reactivate the withdrawn application instead of creating a new one
      application = await Application.findByIdAndUpdate(
        withdrawnApplication._id,
        {
          status: 'pending',
          expectedSalary,
          availability,
          coverLetter,
          resume: req.body.resume || withdrawnApplication.resume || "",
          appliedDate: new Date(),
          updatedAt: new Date()
        },
        { new: true }
      );

      // Add back to job's applications array if not already there
      await Job.findByIdAndUpdate(jobId, {
        $addToSet: { applications: application._id } // $addToSet prevents duplicates
      });

      // Add back to employer's applications array if not already there
      await Employer.findByIdAndUpdate(job.employer, {
        $addToSet: { applications: application._id } // $addToSet prevents duplicates
      });

      // Only increment activeApplications (not totalApplications since it was already counted)
      await User.findByIdAndUpdate(applicantId, {
        $inc: { 
          "applications.activeApplications": 1
        }
      });
    } else {
      // Create new application
      application = new Application({
        jobId,
        applicantId,
        employerId: job.employer,
        expectedSalary,
        availability,
        coverLetter,
        resume: req.body.resume || "", // Should be file URL from upload
      });

      await application.save();

      // Update job applications array
      await Job.findByIdAndUpdate(jobId, {
        $push: { applications: application._id }
      });

      // Update employer applications array
      await Employer.findByIdAndUpdate(job.employer, {
        $push: { applications: application._id }
      });

      await User.findByIdAndUpdate(applicantId, {
        $push: { 
          "applications.appliedJobs": {
            jobId,
            role: job.title,
            company: job.companyName,
            date: new Date()
          }
        },
        $inc: { 
          "applications.totalApplications": 1,
          "applications.activeApplications": 1
        }
      });
    }

    res.status(201).json({
      message: "Application submitted successfully",
      data: application,
      pointsAwarded: 0
    });

    setImmediate(async () => {
      try {
        const { sendApplicationConfirmationEmail, sendNewApplicationNotificationEmail } = require('../applyForJob');
        const applicantName = applicant.fullName || applicant.name || 'Job Seeker';
        
        // Send email to jobseeker
        if (applicant.email) {
          await sendApplicationConfirmationEmail(
            applicant.email,
            applicantName,
            job.title,
            job.companyName || 'Company',
            application.appliedDate || new Date()
          );
        }

        // Send email to employer
        const employer = await Employer.findById(job.employer).select('email companyEmail contactPerson name companyName');
        const employerEmail = employer?.companyEmail || employer?.email || employer?.contactPerson?.email;
        const employerName = employer?.name || employer?.companyName || 'Employer';
        
        if (employerEmail) {
          await sendNewApplicationNotificationEmail(
            employerEmail,
            employerName,
            job.title,
            applicantName,
            application.appliedDate || new Date()
          );
        }
      } catch (err) {
        // Email error handled silently
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to submit application", 
      error: error.message 
    });
  }
};
// Get all applications for an employer
exports.getEmployerApplications = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { status, jobId, page = 1, limit = 20 } = req.query;

    let query = { 
      employerId,
      status: { $ne: 'withdrawn' } // Exclude withdrawn applications from employer view
    };
    if (status) query.status = status;
    if (jobId) query.jobId = jobId;

    const applications = await Application.find(query)
      .populate('jobId', 'title companyName location salary')
      .populate('applicantId', 'name fullName email phoneNumber location dateOfBirth nationality emirateId passportNumber employmentVisa introVideo resumeDocument professionalSummary refersLink referredMember professionalExperience education skills certifications profilePicture membershipTier jobPreferences socialLinks rmService rewards referralRewardPoints applications savedJobs profileCompleted points')
      .sort({ appliedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments(query);

    // Transform applications to match frontend expectations
    const transformedApplications = applications.map(app => ({
      ...app.toObject(),
      applicantDetails: app.applicantId, // Map applicantId to applicantDetails
      jobDetails: app.jobId // Map jobId to jobDetails
    }));

    res.json({
      data: transformedApplications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to fetch applications", 
      error: error.message 
    });
  }
};

// Get applications for a specific job
exports.getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employerId = req.user.id;

    // Verify job belongs to employer
    const job = await Job.findOne({ _id: jobId, employer: employerId });
    if (!job) {
      return res.status(404).json({ message: "Job not found or access denied" });
    }

    const applications = await Application.find({ 
      jobId,
      status: { $ne: 'withdrawn' } // Exclude withdrawn applications from employer view
    })
      .populate('applicantDetails', 'name email phone location profilePicture membershipTier professionalSummary')
      .sort({ appliedDate: -1 });

    res.json({ data: applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to fetch job applications", 
      error: error.message 
    });
  }
};

// Update application status
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, notes, interviewDate, interviewMode } = req.body;
    const employerId = req.user.id;

    // Verify application belongs to employer and populate referredBy for referral points
    const application = await Application.findOne({ _id: applicationId, employerId })
      .populate('referredBy', '_id');
    if (!application) {
      return res.status(404).json({ message: "Application not found or access denied" });
    }

    // Check if this is the first time being viewed
    const wasNotViewedBefore = !application.viewedByEmployer;
    
    // Prepare update object
    const updateData = {
      status, 
      employerNotes: notes || application.employerNotes,
      viewedByEmployer: true,
      viewedDate: new Date()
    };

    // Add interview-specific fields if status is interview_scheduled
    if (status === 'interview_scheduled') {
      if (interviewDate) updateData.interviewDate = new Date(interviewDate);
      if (interviewMode) updateData.interviewMode = interviewMode;
    }
    
    const updatedApplication = await Application.findByIdAndUpdate(
      applicationId,
      updateData,
      { new: true }
    ).populate('applicantDetails', 'name email phone');

    // If this is the first time the application is being viewed, increment user's awaitingFeedback count
    if (wasNotViewedBefore) {
      await User.findByIdAndUpdate(application.applicantId, {
        $inc: { 'applications.awaitingFeedback': 1 }
      });
    }

    res.json({
      message: "Application status updated successfully",
      data: updatedApplication
    });

    setImmediate(async () => {
      try {
        const { sendApplicationStatusUpdateEmail } = require('../updateOnApplication');
        const applicant = updatedApplication.applicantDetails || await User.findById(application.applicantId).select('email fullName name');
        const job = await Job.findById(application.jobId).select('title companyName');
        const applicantName = applicant?.fullName || applicant?.name || 'Job Seeker';
        const interviewInfo = status === 'interview_scheduled' ? { date: updateData.interviewDate, mode: interviewMode } : null;
        
        if (applicant?.email) {
          await sendApplicationStatusUpdateEmail(
            applicant.email,
            applicantName,
            job?.title || 'Job',
            job?.companyName || 'Company',
            status,
            interviewInfo
          );
        }
      } catch (err) {
        // Email error handled silently
      }
    });

    if (status === 'hired' && application.status !== 'hired') {
      try {
        await Employer.findByIdAndUpdate(employerId, { $inc: { points: 50 } });
        console.log('[Points] +50 awarded to employer for hiring:', employerId);
      } catch (pointsErr) {
        console.error('[Points] Failed to award hiring points:', pointsErr);
      }

      // Award placement points (1% of job salary) to referrer if application was a referral and friend gets hired
      if (application.referredBy) {
        try {
          // Fetch job to get salary information
          const job = await Job.findById(application.jobId).select('salary title companyName');
          
          if (job && job.salary) {
            // Calculate 1% of total salary (using average of min and max)
            const salaryMin = job.salary.min || 0;
            const salaryMax = job.salary.max || 0;
            const averageSalary = (salaryMin + salaryMax) / 2;
            const placementPoints = Math.round(averageSalary * 0.01); // 1% of salary as placement points
            
            // Handle both populated and unpopulated referredBy field
            let referrerId;
            if (application.referredBy._id) {
              referrerId = application.referredBy._id.toString();
            } else if (application.referredBy.toString) {
              referrerId = application.referredBy.toString();
            } else {
              referrerId = application.referredBy;
            }
            
            // Update referrer with placement points (1% of job salary)
            const updateResult = await User.findByIdAndUpdate(referrerId, {
              $inc: { 
                "points": placementPoints,
                "referralRewardPoints": placementPoints,
                "rewards.totalPoints": placementPoints,
                "rewards.referFriend": placementPoints
              }
            }, { new: true });
            
            if (updateResult) {
              console.log('[ReferralPlacementPoints] ✓ Successfully awarded placement points (1% of salary) to referrer:', {
                referrerId: referrerId,
                jobTitle: job.title,
                companyName: job.companyName,
                salaryMin: salaryMin,
                salaryMax: salaryMax,
                averageSalary: averageSalary,
                placementPoints: placementPoints,
                newReferralRewardPoints: updateResult.referralRewardPoints,
                newPoints: updateResult.points,
                applicationId: applicationId
              });
            } else {
              console.error('[ReferralPlacementPoints] ✗ Referrer not found:', referrerId);
            }
          } else {
            console.log('[ReferralPlacementPoints] Job salary not found for job:', application.jobId);
          }
        } catch (placementErr) {
          console.error('[ReferralPlacementPoints] ✗ Failed to award placement points:', {
            error: placementErr.message,
            stack: placementErr.stack,
            applicationId: applicationId
          });
        }
      } else {
        console.log('[ReferralPlacementPoints] No referrer found for application:', applicationId, '- This application was not a referral');
      }

      // Note: Referral points (20 points) are now awarded immediately when referral application is created
      // No need to award points again when status changes to hired
      console.log('[ReferralPoints] Application marked as hired. Points were already awarded when referral was created.');
    } else if (status === 'hired' && application.status === 'hired') {
      console.log('[ReferralPoints] Application already marked as hired, skipping point award to prevent duplicates:', applicationId);
    }
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ 
      message: "Failed to update application status", 
      error: error.message 
    });
  }
};

// Rate applicant
exports.rateApplicant = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { rating, feedback } = req.body;
    const employerId = req.user.id;

    // Verify application belongs to employer
    const application = await Application.findOne({ _id: applicationId, employerId });
    if (!application) {
      return res.status(404).json({ message: "Application not found or access denied" });
    }

    const updatedApplication = await Application.findByIdAndUpdate(
      applicationId,
      { rating, feedback },
      { new: true }
    );

    res.json({
      message: "Applicant rated successfully",
      data: updatedApplication
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to rate applicant", 
      error: error.message 
    });
  }
};

// Get employer dashboard data
exports.getEmployerDashboard = async (req, res) => {
  try {
    const employerId = req.user.id;

    // Get counts (exclude withdrawn applications from employer view)
    const totalJobs = await Job.countDocuments({ employer: employerId });
    const activeJobs = await Job.countDocuments({ employer: employerId, status: "active" });
    const totalApplications = await Application.countDocuments({ 
      employerId, 
      status: { $ne: 'withdrawn' } 
    });
    const pendingApplications = await Application.countDocuments({ 
      employerId, 
      status: "pending" 
    });
    const shortlistedApplications = await Application.countDocuments({ 
      employerId, 
      status: "shortlisted" 
    });
    const hiredCount = await Application.countDocuments({ 
      employerId, 
      status: "hired" 
    });

    // Get recent applications (exclude withdrawn)
    const recentApplications = await Application.find({ 
      employerId,
      status: { $ne: 'withdrawn' }
    })
      .populate('jobDetails', 'title')
      .populate('applicantDetails', 'name email profilePicture membershipTier')
      .sort({ appliedDate: -1 })
      .limit(5);

    // Get active jobs with application counts (exclude withdrawn applications)
    const activeJobsWithStats = await Job.aggregate([
      { $match: { employer: employerId, status: "active" } },
      {
        $lookup: {
          from: "applications",
          localField: "_id",
          foreignField: "jobId",
          as: "applications",
          pipeline: [
            { $match: { status: { $ne: 'withdrawn' } } } // Exclude withdrawn applications
          ]
        }
      },
      {
        $project: {
          title: 1,
          location: 1,
          createdAt: 1,
          applicationCount: { $size: "$applications" }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      metrics: {
        totalJobs,
        activeJobs,
        totalApplications,
        pendingApplications,
        shortlistedApplications,
        hiredCount
      },
      recentApplications,
      activeJobs: activeJobsWithStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to fetch dashboard data", 
      error: error.message 
    });
  }
};

// Get job seeker's applications
exports.getUserApplications = async (req, res) => {
  try {
    const applicantId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    console.log('getUserApplications - applicantId:', applicantId);
    console.log('getUserApplications - query params:', { status, page, limit });

    let query = { applicantId };
    if (status) query.status = status;

    const applications = await Application.find(query)
      .populate({
        path: 'jobId',
        select: 'title companyName location salary jobType experienceLevel status applicationDeadline description requirements skills',
        populate: {
          path: 'employer',
          select: 'companyName'
        }
      })
      .populate('referredBy', 'name email')
      .sort({ appliedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments(query);

    console.log('getUserApplications - found applications:', applications.length);
    console.log('getUserApplications - total count:', total);

    // Get counts for different statuses
    const statusCounts = await Application.aggregate([
      { $match: { applicantId: new mongoose.Types.ObjectId(applicantId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      total,
      pending: 0,
      shortlisted: 0,
      interview_scheduled: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0
    };

    statusCounts.forEach(item => {
      if (stats.hasOwnProperty(item._id)) {
        stats[item._id] = item.count;
      }
    });

    res.json({
      data: applications,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to fetch applications", 
      error: error.message 
    });
  }
};

// Get single application by ID
exports.getApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('Getting application by ID:', applicationId);
    console.log('User ID:', userId, 'Role:', userRole);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ message: "Invalid application ID format" });
    }

    // Find application with full population
    const application = await Application.findById(applicationId)
      .populate('applicantId', 'name fullName email phoneNumber location dateOfBirth nationality emirateId passportNumber employmentVisa introVideo resumeDocument professionalSummary refersLink referredMember professionalExperience education skills certifications profilePicture membershipTier jobPreferences socialLinks rmService rewards referralRewardPoints applications savedJobs profileCompleted points')
      .populate({
        path: 'jobId', 
        select: 'title companyName location salary jobType experienceLevel description requirements skills',
        populate: {
          path: 'employer',
          select: 'companyName'
        }
      });

    console.log('Found application:', !!application);

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    console.log('Application details:', {
      id: application._id,
      jobId: application.jobId?._id,
      employerId: application.employerId,
      applicantId: application.applicantId?._id
    });

    // Check access permissions based on user role
    if (userRole === 'employer') {
      // For employers, verify the job belongs to them
      const job = await Job.findOne({ _id: application.jobId._id, employer: userId });
      if (!job) {
        console.log('Job not found or access denied for employer');
        return res.status(404).json({ message: "Application not found or access denied" });
      }

      // Mark as viewed by employer and update user's awaitingFeedback count
      const wasNotViewedBefore = !application.viewedByEmployer;
      
      await Application.findByIdAndUpdate(applicationId, {
        viewedByEmployer: true,
        viewedDate: new Date()
      });

      // If this is the first time the application is being viewed, increment user's awaitingFeedback count
      if (wasNotViewedBefore) {
        await User.findByIdAndUpdate(application.applicantId, {
          $inc: { 'applications.awaitingFeedback': 1 }
        });
      }
    } else if (userRole === 'jobseeker') {
      // For jobseekers, verify they own this application OR they referred this person
      const isOwner = application.applicantId._id.toString() === userId;
      // Handle both populated and unpopulated referredBy field
      const referredById = application.referredBy?._id ? application.referredBy._id.toString() : application.referredBy?.toString();
      const isReferrer = referredById === userId;
      
      if (!isOwner && !isReferrer) {
        console.log('Application access denied for jobseeker - not owner or referrer', {
          userId,
          applicantId: application.applicantId._id.toString(),
          referredBy: referredById,
          isOwner,
          isReferrer
        });
        return res.status(404).json({ message: "Application not found or access denied" });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Transform the response to match frontend expectations
    const responseData = {
      ...application.toObject(),
      applicantDetails: application.applicantId, // Map applicantId to applicantDetails for frontend
      jobDetails: {
        title: application.jobId.title,
        companyName: application.jobId.companyName,
        location: application.jobId.location,
        salary: application.jobId.salary,
        jobType: application.jobId.jobType,
        experienceLevel: application.jobId.experienceLevel,
        description: application.jobId.description,
        requirements: application.jobId.requirements,
        skills: application.jobId.skills,
        employer: application.jobId.employer
      }
    };

    res.json({
      message: "Application retrieved successfully",
      data: responseData
    });
  } catch (error) {
    console.error('Error in getApplicationById:', error);
    res.status(500).json({ 
      message: "Failed to fetch application", 
      error: error.message 
    });
  }
};

exports.getJobSeekerInterviews = async (req, res) => {
  try {
    const applicantId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    let query = { 
      applicantId,
      status: 'interview_scheduled'
    };

    const interviews = await Application.find(query)
      .populate({
        path: 'jobId',
        select: 'title companyName location',
        populate: {
          path: 'employer',
          select: 'companyName'
        }
      })
      .populate('employerId', 'companyName')
      .sort({ interviewDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments(query);

    res.json({
      data: interviews,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching jobseeker interviews:', error);
    res.status(500).json({ 
      message: "Failed to fetch interviews", 
      error: error.message 
    });
  }
};

// Get interviews for employer
exports.getEmployerInterviews = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    let query = { 
      employerId,
      status: 'interview_scheduled'
    };

    const interviews = await Application.find(query)
      .populate({
        path: 'jobId',
        select: 'title companyName location'
      })
      .populate('applicantId', 'name fullName email phoneNumber profilePicture')
      .sort({ interviewDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments(query);

    res.json({
      data: interviews,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching employer interviews:', error);
    res.status(500).json({ 
      message: "Failed to fetch interviews", 
      error: error.message 
    });
  }
};

// Create referral application (when User A refers User B)
exports.createReferralApplication = async (req, res) => {
  try {
    const { 
      jobId, 
      friendName, 
      email, 
      phone, 
      dateOfBirth, 
      nationality, 
      currentCompany, 
      expectedSalary, 
      location, 
      education, 
      skills, 
      certifications, 
      resumeUrl 
    } = req.body;
    const referrerId = req.user.id; // User A who is making the referral

    // Check if job exists and is active
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status !== "active") {
      return res.status(400).json({ message: "Job is not accepting applications" });
    }

    // Check if User B already exists by email
    let userB = await User.findOne({ email });
    
    if (!userB) {
      // Create User B account if they don't exist
      const tempPassword = "12345678";
      userB = new User({
        email,
        password: tempPassword,
        role: "jobseeker",
        name: friendName,
        phoneNumber: phone,
        dateOfBirth,
        nationality,
        location,
        professionalExperience: [{
          currentRole: "Not specified",
          company: currentCompany,
          startDate: new Date(),
          isCurrent: true
        }],
        education: [{
          highestDegree: education,
          degree: education,
          institution: "Not specified",
          graduationYear: new Date().getFullYear()
        }],
        skills: skills ? skills.split(',').map(skill => skill.trim()).filter(Boolean) : [],
        certifications: certifications ? certifications.split(',').map(cert => cert.trim()).filter(Boolean) : [],
        resumeDocument: resumeUrl
      });
      await userB.save();
    } else {
      // Update existing user with referral data (education and certifications)
      const updateData = {};
      
      // Update education if provided
      if (education) {
        if (!userB.education || userB.education.length === 0) {
          updateData.education = [{
            highestDegree: education,
            degree: education,
            institution: "Not specified",
            graduationYear: new Date().getFullYear()
          }];
        } else {
          // Update first education entry
          const updatedEducation = [...userB.education];
          updatedEducation[0] = {
            ...updatedEducation[0],
            highestDegree: education,
            degree: education
          };
          updateData.education = updatedEducation;
        }
      }
      
      // Update certifications if provided
      if (certifications) {
        const certArray = certifications.split(',').map(cert => cert.trim()).filter(Boolean);
        if (certArray.length > 0) {
          updateData.certifications = certArray;
        }
      }
      
      // Update skills if provided
      if (skills) {
        const skillsArray = skills.split(',').map(skill => skill.trim()).filter(Boolean);
        if (skillsArray.length > 0) {
          updateData.skills = skillsArray;
        }
      }
      
      // Update other fields if missing
      if (!userB.phoneNumber && phone) updateData.phoneNumber = phone;
      if (!userB.location && location) updateData.location = location;
      if (!userB.nationality && nationality) updateData.nationality = nationality;
      if (!userB.dateOfBirth && dateOfBirth) updateData.dateOfBirth = dateOfBirth;
      if (!userB.resumeDocument && resumeUrl) updateData.resumeDocument = resumeUrl;
      
      if (Object.keys(updateData).length > 0) {
        await User.findByIdAndUpdate(userB._id, { $set: updateData });
        // Reload user to get updated data
        userB = await User.findById(userB._id);
      }
    }

    // Check if User B already applied for this job (excluding withdrawn applications - allow re-applying after withdrawal)
    const existingApplication = await Application.findOne({ 
      jobId, 
      applicantId: userB._id, 
      status: { $ne: 'withdrawn' } 
    });
    if (existingApplication) {
      return res.status(400).json({ message: "This person has already applied to this job" });
    }

    // Create application with referral information
    const application = new Application({
      jobId,
      applicantId: userB._id,
      employerId: job.employer,
      expectedSalary: {
        min: parseInt(expectedSalary) - 2000,
        max: parseInt(expectedSalary) + 2000
      },
      availability: "Immediate",
      resume: resumeUrl,
      referredBy: referrerId // Set referrer ID for job placement referral points
    });

    await application.save();
    
    console.log('[CreateReferralApplication] Application created with referrer:', {
      applicationId: application._id,
      referrerId: referrerId,
      applicantId: userB._id,
      jobId: jobId
    });

    // Award 20 points to referrer immediately when referral application is created
    try {
      const updateResult = await User.findByIdAndUpdate(referrerId, {
        $inc: { 
          "points": 20,
          "referralRewardPoints": 20,
          "rewards.totalPoints": 20,
          "rewards.referFriend": 20
        }
      }, { new: true });
      
      if (updateResult) {
        console.log('[ReferralPoints] ✓ Successfully awarded 20 points to referrer immediately:', referrerId, {
          newReferralRewardPoints: updateResult.referralRewardPoints,
          newReferFriendPoints: updateResult.rewards?.referFriend,
          newPoints: updateResult.points,
          applicationId: application._id,
          jobId: jobId
        });
      } else {
        console.error('[ReferralPoints] ✗ User not found for referrer ID:', referrerId);
      }
    } catch (referralErr) {
      console.error('[ReferralPoints] ✗ Failed to award referral points immediately:', {
        error: referralErr.message,
        stack: referralErr.stack,
        referrerId: referrerId,
        applicationId: application._id
      });
    }

    // Update job applications array
    await Job.findByIdAndUpdate(jobId, {
      $push: { applications: application._id }
    });

    // Update employer applications array
    await Employer.findByIdAndUpdate(job.employer, {
      $push: { applications: application._id }
    });

    await User.findByIdAndUpdate(userB._id, {
      $push: { 
        "applications.appliedJobs": {
          jobId,
          role: job.title,
          company: job.companyName,
          date: new Date()
        }
      },
      $inc: { 
        "applications.totalApplications": 1,
        "applications.activeApplications": 1
      }
    });

    // Send HTTP response FIRST
    res.status(201).json({
      message: "Referral application submitted successfully",
      data: {
        application,
        userCreated: !await User.findOne({ email, _id: { $ne: userB._id } })
      }
    });
  } catch (error) {
    console.error("Referral application error:", error);
    res.status(500).json({ 
      message: "Failed to submit referral application", 
      error: error.message 
    });
  }
};

// Withdraw application (job seeker withdraws their own application)
exports.withdrawApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const applicantId = req.user.id;

    console.log('Withdrawing application:', applicationId, 'for user:', applicantId);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ message: "Invalid application ID format" });
    }

    // Find application and verify it belongs to the user
    const application = await Application.findById(applicationId)
      .populate('jobId', 'title companyName employer applications');

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Verify the application belongs to the requesting user
    if (application.applicantId.toString() !== applicantId) {
      return res.status(403).json({ message: "Access denied. You can only withdraw your own applications." });
    }

    // Check if application can be withdrawn (e.g., not already hired, rejected, or withdrawn)
    if (application.status === 'hired') {
      return res.status(400).json({ 
        message: "Cannot withdraw application - you have already been hired for this position." 
      });
    }

    if (application.status === 'rejected') {
      return res.status(400).json({ 
        message: "Cannot withdraw application - this application has already been rejected." 
      });
    }

    if (application.status === 'withdrawn') {
      return res.status(400).json({ 
        message: "This application has already been withdrawn." 
      });
    }

    // Remove application from job's applications array (so employer doesn't see it)
    if (application.jobId && application.jobId._id) {
      await Job.findByIdAndUpdate(application.jobId._id, {
        $pull: { applications: applicationId }
      });
    }

    // Remove application from employer's applications array (so employer doesn't see it)
    if (application.employerId) {
      await Employer.findByIdAndUpdate(application.employerId, {
        $pull: { applications: applicationId }
      });
    }

    // Update user's application counts - only decrement activeApplications, keep totalApplications
    const updateData = {
      $inc: { 
        'applications.activeApplications': -1
      }
    };

    // If the application was viewed by employer, also decrement awaitingFeedback
    if (application.viewedByEmployer) {
      updateData.$inc['applications.awaitingFeedback'] = -1;
    }

    // Update user counts but keep the application in appliedJobs for history
    await User.findByIdAndUpdate(applicantId, updateData);

    // Update application status to 'withdrawn' instead of deleting
    // This keeps it visible to jobseeker but hidden from employer
    const withdrawnApplication = await Application.findByIdAndUpdate(
      applicationId,
      { 
        status: 'withdrawn',
        updatedAt: new Date()
      },
      { new: true }
    ).populate('jobId', 'title companyName');

    res.json({
      message: `Application for ${withdrawnApplication.jobId.title} has been withdrawn successfully`,
      data: {
        applicationId,
        jobTitle: withdrawnApplication.jobId.title,
        companyName: withdrawnApplication.jobId.companyName,
        status: 'withdrawn',
        withdrawnAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error withdrawing application:', error);
    res.status(500).json({ 
      message: "Failed to withdraw application", 
      error: error.message 
    });
  }
};

// Get user's referral history (applications they created by referring others)
exports.getUserReferralHistory = async (req, res) => {
  try {
    const referrerId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Find all applications where this user is the referrer
    const referralApplications = await Application.find({ referredBy: referrerId })
      .populate({
        path: 'jobId',
        select: 'title companyName location salary skills experienceLevel requirements'
      })
      .populate({
        path: 'applicantId',
        select: 'name email phoneNumber location skills professionalExperience education'
      })
      .sort({ appliedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments({ referredBy: referrerId });

    // Calculate match score based on actual criteria
    const calculateMatchScore = (application) => {
      let totalScore = 0;
      let maxPossibleScore = 0;
      
      const job = application.jobId;
      const applicant = application.applicantId;
      
      // 1. Skills Match (30% weight)
      if (job?.skills && applicant?.skills) {
        const jobSkills = job.skills.map(skill => skill.toLowerCase());
        const applicantSkills = applicant.skills.map(skill => skill.toLowerCase());
        const matchingSkills = jobSkills.filter(skill => 
          applicantSkills.some(appSkill => appSkill.includes(skill) || skill.includes(appSkill))
        );
        const skillsScore = jobSkills.length > 0 ? (matchingSkills.length / jobSkills.length) * 30 : 15;
        totalScore += skillsScore;
      } else {
        totalScore += 15; // Default moderate score if data missing
      }
      maxPossibleScore += 30;

      // 2. Experience Level (25% weight)
      if (job?.experienceLevel && applicant?.professionalExperience) {
        const jobExpLevel = job.experienceLevel.toLowerCase();
        const applicantYears = applicant.professionalExperience.length || 0;
        
        let expScore = 0;
        if (jobExpLevel.includes('entry') || jobExpLevel.includes('junior')) {
          expScore = applicantYears <= 2 ? 25 : applicantYears <= 5 ? 20 : 15;
        } else if (jobExpLevel.includes('mid') || jobExpLevel.includes('intermediate')) {
          expScore = applicantYears >= 2 && applicantYears <= 7 ? 25 : 18;
        } else if (jobExpLevel.includes('senior') || jobExpLevel.includes('lead')) {
          expScore = applicantYears >= 5 ? 25 : applicantYears >= 3 ? 20 : 15;
        } else {
          expScore = 18; // Default for unspecified
        }
        totalScore += expScore;
      } else {
        totalScore += 18; // Default moderate score
      }
      maxPossibleScore += 25;

      // 3. Location Match (15% weight)
      if (job?.location && applicant?.location) {
        const jobLocation = job.location.toLowerCase();
        const applicantLocation = applicant.location.toLowerCase();
        const locationScore = jobLocation.includes(applicantLocation) || 
                            applicantLocation.includes(jobLocation) ? 15 : 8;
        totalScore += locationScore;
      } else {
        totalScore += 10; // Default moderate score
      }
      maxPossibleScore += 15;

      // 4. Salary Expectations (15% weight)
      if (job?.salary && application?.expectedSalary) {
        const jobSalaryMid = (job.salary.min + job.salary.max) / 2;
        const expectedSalaryMid = (application.expectedSalary.min + application.expectedSalary.max) / 2;
        const salaryDiff = Math.abs(jobSalaryMid - expectedSalaryMid) / jobSalaryMid;
        
        let salaryScore = 0;
        if (salaryDiff <= 0.1) salaryScore = 15; // Within 10%
        else if (salaryDiff <= 0.2) salaryScore = 12; // Within 20%
        else if (salaryDiff <= 0.3) salaryScore = 8; // Within 30%
        else salaryScore = 5; // More than 30% difference
        
        totalScore += salaryScore;
      } else {
        totalScore += 10; // Default moderate score
      }
      maxPossibleScore += 15;

      // 5. Education Requirements (15% weight)
      if (job?.requirements && applicant?.education) {
        const jobReqs = job.requirements.join(' ').toLowerCase();
        const hasEducationReq = jobReqs.includes('degree') || jobReqs.includes('bachelor') || 
                               jobReqs.includes('master') || jobReqs.includes('phd') || 
                               jobReqs.includes('diploma');
        
        if (hasEducationReq && applicant.education.length > 0) {
          const highestEducation = applicant.education[0]?.degree?.toLowerCase() || '';
          let educationScore = 0;
          
          if (highestEducation.includes('phd') || highestEducation.includes('doctorate')) {
            educationScore = 15;
          } else if (highestEducation.includes('master')) {
            educationScore = 14;
          } else if (highestEducation.includes('bachelor')) {
            educationScore = 12;
          } else if (highestEducation.includes('diploma')) {
            educationScore = 10;
          } else {
            educationScore = 8;
          }
          totalScore += educationScore;
        } else if (!hasEducationReq) {
          totalScore += 12; // No specific education requirement
        } else {
          totalScore += 6; // Education required but not provided
        }
      } else {
        totalScore += 10; // Default moderate score
      }
      maxPossibleScore += 15;

      // Calculate final percentage
      let baseScore = (totalScore / maxPossibleScore) * 100;
      
      // Apply status-based adjustments (smaller impact now)
      switch (application.status) {
        case 'hired':
          baseScore = Math.min(baseScore + 5, 98); // Small bonus for hired
          break;
        case 'interview_scheduled':
          baseScore = Math.min(baseScore + 3, 95); // Small bonus for interviews
          break;
        case 'shortlisted':
          baseScore = Math.min(baseScore + 2, 92); // Small bonus for shortlisted
          break;
        case 'rejected':
          baseScore = Math.max(baseScore - 10, 25); // Penalty for rejected
          break;
        // 'pending' gets no adjustment
      }

      return Math.round(baseScore);
    };

    // Transform data for frontend
    const referralHistory = referralApplications.map(app => ({
      id: app._id,
      referredUser: app.applicantId?.name || 'Unknown User',
      referredUserEmail: app.applicantId?.email || '',
      jobTitle: app.jobId?.title || 'Unknown Job',
      company: app.jobId?.companyName || 'Unknown Company',
      date: app.appliedDate,
      status: app.status,
      lastUpdate: app.updatedAt,
      applicationId: app._id,
      matchScore: calculateMatchScore(app)
    }));

    // Get stats
    const stats = {
      total,
      pending: 0,
      shortlisted: 0,
      interview_scheduled: 0,
      hired: 0,
      rejected: 0
    };

    // Count by status
    const statusCounts = await Application.aggregate([
      { $match: { referredBy: new mongoose.Types.ObjectId(referrerId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    statusCounts.forEach(item => {
      if (stats.hasOwnProperty(item._id)) {
        stats[item._id] = item.count;
      }
    });

    res.json({
      message: "Referral history retrieved successfully",
      data: referralHistory,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Get referral history error:", error);
    res.status(500).json({ 
      message: "Failed to get referral history", 
      error: error.message 
    });
  }
};

module.exports = exports;
