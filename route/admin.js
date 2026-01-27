const express = require("express");
const router = express.Router();
const FindrUser = require("../model/UserSchemas");
const Employer = require("../model/EmployerSchema");
const Job = require("../model/JobSchema");
const Application = require("../model/ApplicationSchema");
const QuoteRequest = require("../model/QuoteRequestSchema");
const Admin = require("../model/AdminSchema");
const Grievance = require("../model/Grievance");
const jwt = require("jsonwebtoken");

// Create Admin Account
router.post("/admin/create-admin", async (req, res) => {
  try {
    const { name, email, password, role = "admin" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    if (!["admin", "superadmin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role. Must be 'admin' or 'superadmin'" });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Admin with this email already exists" });
    }

    const admin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password,
      role
    });

    const { password: _, ...adminSafe } = admin.toObject();

    return res.status(201).json({ success: true, message: "Admin created successfully", data: adminSafe });
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({ success: false, message: "Internal server error while creating admin", error: error.message });
  }
});

// Admin Login
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Plain-text comparison as requested
    if (admin.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role || "admin",
        type: "admin",
        email: admin.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const { password: _, ...adminSafe } = admin.toObject();

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      user: {
        id: adminSafe._id,
        email: adminSafe.email,
        type: "admin",
        name: adminSafe.name,
        role: adminSafe.role || "admin",
      },
      token,
    });
  } catch (error) {
    console.error("Error during admin login:", error);
    return res.status(500).json({ success: false, message: "Internal server error during admin login", error: error.message });
  }
});

// List all admins
router.get("/admin/admins", async (req, res) => {
  try {
    const admins = await Admin.find({}).select("_id name email password role createdAt").lean();
    return res.status(200).json({ success: true, data: admins });
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch admins", error: error.message });
  }
});

// Delete an admin by id
router.delete("/admin/admins/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent deleting the last remaining admin
    const totalAdmins = await Admin.countDocuments();
    if (totalAdmins <= 1) {
      return res.status(400).json({ success: false, message: "Cannot delete the last remaining admin" });
    }
    const deleted = await Admin.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    return res.status(200).json({ success: true, message: "Admin deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return res.status(500).json({ success: false, message: "Failed to delete admin", error: error.message });
  }
});

// Admin Users Endpoint - Get users by type
router.get("/admin/users/:userType", async (req, res) => {
  try {
    const { userType } = req.params;
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Validate userType parameter
    if (!['jobseeker', 'employer'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user type. Must be 'jobseeker' or 'employer'"
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    let users, totalCount;

    if (userType === 'jobseeker') {
      // Build search query for jobseekers
      const searchQuery = search ? {
        role: "jobseeker",
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { nationality: { $regex: search, $options: 'i' } },
          { 'professionalExperience.currentRole': { $regex: search, $options: 'i' } },
          { 'professionalExperience.company': { $regex: search, $options: 'i' } },
          { 'professionalExperience.industry': { $regex: search, $options: 'i' } }
        ]
      } : { role: "jobseeker" };

      // Get jobseekers with pagination and sorting
      [users, totalCount] = await Promise.all([
        FindrUser.find(searchQuery)
          .select('_id name fullName email phoneNumber location nationality professionalExperience profilePicture loginStatus createdAt updatedAt')
          .sort({ [sortBy]: sortDirection })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        FindrUser.countDocuments(searchQuery)
      ]);

      // Transform jobseeker data to match frontend expectations
      users = users.map(user => ({
        id: user._id.toString(),
        fullName: user.fullName || user.name || 'N/A',
        emailAddress: user.email,
        phoneNumber: user.phoneNumber || 'N/A',
        location: user.location || 'N/A',
        nationality: user.nationality || 'N/A',
        currentRole: user.professionalExperience?.[0]?.currentRole || 'N/A',
        company: user.professionalExperience?.[0]?.company || 'N/A',
        yearsOfExperience: user.professionalExperience?.[0]?.yearsOfExperience || 0,
        industry: user.professionalExperience?.[0]?.industry || 'N/A',
        profileUrl: `/candidate/${user._id}`,
        loginStatus: user.loginStatus || 'active',
        profileImage: user.profilePicture || '',
        joinedDate: user.createdAt,
        lastActive: user.updatedAt
      }));

    } else if (userType === 'employer') {
      // Build search query for employers
      const searchQuery = search ? {
        $or: [
          { companyName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { companyEmail: { $regex: search, $options: 'i' } },
          { industry: { $regex: search, $options: 'i' } },
          { website: { $regex: search, $options: 'i' } },
          { companyLocation: { $regex: search, $options: 'i' } }
        ]
      } : {};

      // Get employers with pagination and sorting
      [users, totalCount] = await Promise.all([
        Employer.find(searchQuery)
          .select('_id companyName email companyEmail phoneNumber website industry teamSize foundedYear companyLocation companyLogo verificationStatus loginStatus createdAt updatedAt')
          .sort({ [sortBy]: sortDirection })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Employer.countDocuments(searchQuery)
      ]);

      // Transform employer data to match frontend expectations
      users = users.map(employer => ({
        id: employer._id.toString(),
        companyName: employer.companyName ,
        companyEmail: employer.companyEmail || employer.email,
        phoneNumber: employer.phoneNumber || 'N/A',
        website: employer.website || 'N/A',
        industry: employer.industry || 'N/A',
        teamSize: employer.teamSize || 'N/A',
        foundedYear: employer.foundedYear || 'N/A',
        location: employer.companyLocation || 'N/A',
        profileUrl: `/employer/profile/${employer._id}`,
        loginStatus: employer.loginStatus ,
        companyLogo: employer.companyLogo ,
        joinedDate: employer.createdAt,
        lastActive: employer.updatedAt
      }));
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      },
      message: `${userType} data fetched successfully`
    });

  } catch (error) {
    console.error(`Error fetching ${req.params.userType} data:`, error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching user data",
      error: error.message
    });
  }
});

// Admin Dashboard Statistics Endpoint
router.get("/admin/dashboard/stats", async (req, res) => {
  try {
    // Get all counts in parallel for better performance
    const [
      jobseekerCount,
      employerCount,
      activeJobsCount,
      applicationsCount,
      servicesOrdersData,
      premiumOrdersData
    ] = await Promise.all([
      // Count jobseekers
      FindrUser.countDocuments({ role: "jobseeker" }),
      
      // Count employers
      Employer.countDocuments({ role: "employer" }),
      
      // Count active jobs
      Job.countDocuments({ status: "active" }),
      
      // Count total applications
      Application.countDocuments(),
      
      // Count services & orders - All individual service/order items
      Promise.all([
        // Count all HR service entries from employers (all statuses)
        Employer.aggregate([
          { $unwind: "$hrServices" },
          { $count: "total" }
        ]).then(result => result[0]?.total || 0),
        
        // Count all orders from jobseekers
        FindrUser.aggregate([
          { $match: { role: "jobseeker", orders: { $exists: true, $ne: [] } } },
          { $unwind: "$orders" },
          { $count: "total" }
        ]).then(result => result[0]?.total || 0),
        
        // Count RM services (jobseekers with Active RM service)
        FindrUser.countDocuments({ 
          role: "jobseeker",
          rmService: "Active" 
        }),
        
        // Count active subscription plans (1 per employer)
        Employer.countDocuments({ 
          subscriptionPlan: { $in: ["basic", "premium", "enterprise"] },
          subscriptionStatus: "active"
        })
      ]).then(([hrServicesCount, ordersCount, rmServicesCount, subscriptionCount]) => {
        // Total all services and orders
        return hrServicesCount + ordersCount + rmServicesCount + subscriptionCount;
      }),
      
      // Count premium orders - subscriptions + RM services
      Promise.all([
        // Count active subscription plans (1 per employer)
        Employer.countDocuments({ 
          subscriptionPlan: { $in: ["basic", "premium", "enterprise"] },
          subscriptionStatus: "active"
        }),
        // Count RM services (jobseekers with Active RM service)
        FindrUser.countDocuments({ 
          role: "jobseeker",
          rmService: "Active" 
        })
      ]).then(([subscriptionCount, rmServiceCount]) => {
        return subscriptionCount + rmServiceCount;
      })
    ]);

    const stats = {
      jobseekers: jobseekerCount,
      employers: employerCount,
      activeJobs: activeJobsCount,
      applications: applicationsCount,
      servicesOrders: servicesOrdersData,
      premiumOrders: premiumOrdersData
    };

    res.status(200).json({
      success: true,
      data: stats,
      message: "Admin dashboard statistics fetched successfully"
    });

  } catch (error) {
    console.error("Error fetching admin dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching dashboard statistics",
      error: error.message
    });
  }
});

// Additional endpoint for detailed analytics (optional)
router.get("/admin/dashboard/analytics", async (req, res) => {
  try {
    const [
      recentApplications,
      recentJobs,
      topEmployers,
      userGrowth
    ] = await Promise.all([
      // Recent applications (last 7 days)
      Application.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      
      // Recent jobs posted (last 7 days)
      Job.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      
      // Top employers by job count
      Job.aggregate([
        { $group: { _id: "$employer", jobCount: { $sum: 1 } } },
        { $sort: { jobCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "employers",
            localField: "_id",
            foreignField: "_id",
            as: "employerInfo"
          }
        }
      ]),
      
      // User growth (last 30 days)
      Promise.all([
        FindrUser.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }),
        Employer.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]).then(([newJobseekers, newEmployers]) => ({
        newJobseekers,
        newEmployers,
        total: newJobseekers + newEmployers
      }))
    ]);

    const analytics = {
      recentApplications,
      recentJobs,
      topEmployers,
      userGrowth
    };

    res.status(200).json({
      success: true,
      data: analytics,
      message: "Admin dashboard analytics fetched successfully"
    });

  } catch (error) {
    console.error("Error fetching admin dashboard analytics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching dashboard analytics",
      error: error.message
    });
  }
});

// Admin Jobs Endpoint - Get all active jobs
router.get("/admin/jobs", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc', status = 'active' } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build search query
    const searchQuery = {
      status: status === 'all' ? { $in: ['active', 'paused', 'closed'] } : status,
      ...(search && {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { companyName: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { skills: { $in: [new RegExp(search, 'i')] } },
          { requirements: { $in: [new RegExp(search, 'i')] } }
        ]
      })
    };

    // Get jobs with pagination and sorting
    const [jobs, totalCount] = await Promise.all([
      Job.find(searchQuery)
        .populate('employer', 'companyName email companyLogo')
        .select('_id title companyName location jobType salary description requirements benefits skills applicationDeadline status views createdAt updatedAt')
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Job.countDocuments(searchQuery)
    ]);

    // Transform job data to match frontend expectations
    const transformedJobs = jobs.map(job => ({
      id: job._id.toString(),
      jobTitle: job.title,
      companyName: job.companyName || job.employer?.companyName || 'N/A',
      location: job.location,
      jobType: Array.isArray(job.jobType) ? job.jobType.join(', ') : job.jobType,
      minimumSalary: job.salary?.min || 0,
      maximumSalary: job.salary?.max || 0,
      applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().split('T')[0] : 'N/A',
      status: job.status,
      jobUrl: `/admin/jobs/${job._id}`,
      description: job.description || '',
      requirements: job.requirements || [],
      benefits: job.benefits || [],
      skills: job.skills || [],
      views: job.views || 0,
      employerInfo: job.employer ? {
        name: job.employer.companyName,
        email: job.employer.email,
        logo: job.employer.companyLogo
      } : null,
      postedDate: job.createdAt,
      lastUpdated: job.updatedAt
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        jobs: transformedJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      },
      message: "Jobs data fetched successfully"
    });

  } catch (error) {
    console.error("Error fetching jobs data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching jobs data",
      error: error.message
    });
  }
});

// Admin Applications Endpoint - Get all applications
router.get("/admin/applications", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'appliedDate', sortOrder = 'desc', status = 'all' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build search query
    const searchOr = [];
    if (search) {
      searchOr.push(
        { coverLetter: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      );
    }

    const statusFilter = status === 'all' ? { $exists: true } : status;

    const baseQuery = {
      ...(searchOr.length ? { $or: searchOr } : {}),
      ...(status ? { status: statusFilter } : {}),
    };

    // Fetch with population
    const [applications, totalCount] = await Promise.all([
      Application.find(baseQuery)
        .populate('jobId', 'title companyName')
        .populate('applicantId', 'name fullName email')
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Application.countDocuments(baseQuery)
    ]);

    const transformed = applications.map(app => ({
      id: app._id.toString(),
      candidate: app.applicantId?.fullName || app.applicantId?.name || app.applicantId?.email || 'N/A',
      jobTitle: app.jobId?.title || 'N/A',
      status: app.status,
      appliedDate: app.appliedDate,
      applicationUrl: `/admin/jobs/${app.jobId?._id || ''}`
    }));

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        applications: transformed,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      },
      message: "Applications data fetched successfully"
    });
  } catch (error) {
    console.error("Error fetching applications data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching applications data",
      error: error.message
    });
  }
});

// Admin Job Actions Endpoint - Update job status
router.patch("/admin/jobs/:jobId/status", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'active', 'paused', or 'closed'"
      });
    }

    // Update job status
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: updatedJob._id.toString(),
        status: updatedJob.status
      },
      message: `Job status updated to ${status} successfully`
    });

  } catch (error) {
    console.error("Error updating job status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating job status",
      error: error.message
    });
  }
});

// Admin Delete Job Endpoint
router.delete("/admin/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    // Find and delete the job
    const deletedJob = await Job.findByIdAndDelete(jobId);

    if (!deletedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found"
      });
    }

    // Also delete related applications
    await Application.deleteMany({ jobId: jobId });

    res.status(200).json({
      success: true,
      message: "Job deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting job",
      error: error.message
    });
  }
});

// Admin Get Individual Job Details
router.get("/admin/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    
    console.log('Admin job details requested for ID:', jobId);
    
    const job = await Job.findById(jobId)
      .populate('employer', 'companyName email companyLogo')
      .lean();

    console.log('Job found:', job ? 'Yes' : 'No');
    console.log('Job title from DB:', job?.title);
    console.log('Job company from DB:', job?.companyName);
    console.log('Employer company from DB:', job?.employer?.companyName);

    if (!job) {
      console.log('Job not found for ID:', jobId);
      return res.status(404).json({
        success: false,
        message: "Job not found"
      });
    }

    // Transform job data to match frontend expectations
    const jobDetails = {
      id: job._id.toString(),
      jobTitle: job.title,
      companyName: job.companyName || job.employer?.companyName || 'N/A',
      location: job.location,
      jobType: Array.isArray(job.jobType) ? job.jobType.join(', ') : job.jobType,
      minimumSalary: job.salary?.min || 0,
      maximumSalary: job.salary?.max || 0,
      applicationDeadline: job.applicationDeadline ? new Date(job.applicationDeadline).toISOString().split('T')[0] : 'N/A',
      status: job.status,
      description: job.description || '',
      requirements: job.requirements || [],
      benefits: job.benefits || [],
      skills: job.skills || [],
      views: job.views || 0,
      employerInfo: job.employer ? {
        name: job.employer.companyName,
        email: job.employer.email,
        logo: job.employer.companyLogo
      } : null,
      postedDate: job.createdAt,
      lastUpdated: job.updatedAt
    };

    console.log('Sending job details response for ID:', jobId);
    
    res.status(200).json({
      success: true,
      data: jobDetails,
      message: "Job details fetched successfully"
    });

  } catch (error) {
    console.error("Error fetching job details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching job details",
      error: error.message
    });
  }
});

// Admin Quotes Endpoint - Get all quote requests
router.get("/admin/quotes", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build filter query - exclude accepted and completed by default
    const filterQuery = {};
    if (status) {
      filterQuery.status = status;
    } else {
      // Default: show only pending, in_progress, and quoted (not accepted/completed)
      filterQuery.status = { $in: ['pending', 'in_progress', 'quoted'] };
    }
    if (priority) filterQuery.priority = priority;
    if (search) {
      filterQuery.$or = [
        { service: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { 'contactPerson.name': { $regex: search, $options: 'i' } },
        { 'contactPerson.email': { $regex: search, $options: 'i' } },
        { requirements: { $regex: search, $options: 'i' } }
      ];
    }

    // Get quotes with pagination and sorting
    const [quotes, totalCount] = await Promise.all([
      QuoteRequest.find(filterQuery)
        .populate('employerId', 'companyName email phoneNumber')
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      QuoteRequest.countDocuments(filterQuery)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        quoteRequests: quotes,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      },
      message: "Quote requests fetched successfully"
    });

  } catch (error) {
    console.error("Error fetching quotes:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching quotes",
      error: error.message
    });
  }
});

// Helper function to map quote service name to HR service enum
const mapServiceToHREnum = (serviceName) => {
  const mapping = {
    'Recruitment & Staffing': 'recruitment',
    'HR Compliance & Onboarding': 'compliance',
    'Performance Management': 'performance',
    'Training & Development': 'training',
    'Payroll Management': 'payroll',
    'HR Analytics & Reporting': 'analytics'
  };
  return mapping[serviceName] || null;
};

// Admin Quote Actions Endpoint - Update quote status
router.put("/admin/quotes/:quoteId", async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { status, adminResponse, priority, note } = req.body;

    // First, get the quote to check employerId and service
    const existingQuote = await QuoteRequest.findById(quoteId);
    if (!existingQuote) {
      return res.status(404).json({
        success: false,
        message: "Quote request not found"
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminResponse) {
      updateData.adminResponse = {
        ...adminResponse,
        respondedBy: 'admin',
        respondedAt: new Date()
      };
    }
    if (note) {
      updateData.$push = {
        notes: {
          note,
          addedBy: 'admin'
        }
      };
    }

    // If status is being set to 'accepted', always append a new HR service entry for employer
    if (status === 'accepted' && existingQuote.employerId) {
      const hrServiceEnum = mapServiceToHREnum(existingQuote.service);
      if (hrServiceEnum) {
        const employer = await Employer.findById(existingQuote.employerId);
        if (employer) {
          if (!employer.hrServices) {
            employer.hrServices = [];
          }
          employer.hrServices.push({
            serviceName: hrServiceEnum,
            status: 'active',
            startDate: new Date()
          });
          employer.markModified('hrServices');
          await employer.save();
        }
      }
    }

    const quote = await QuoteRequest.findByIdAndUpdate(
      quoteId,
      updateData,
      { new: true }
    ).populate('employerId', 'companyName email phoneNumber');

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote request not found"
      });
    }

    res.status(200).json({
      success: true,
      data: quote,
      message: status === 'accepted' ? "Payment confirmed and HR service activated" : "Quote request updated successfully"
    });

  } catch (error) {
    console.error("Error updating quote:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating quote",
      error: error.message
    });
  }
});

// Get individual jobseeker by ID
router.get("/admin/users/jobseeker/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const jobseeker = await FindrUser.findOne({ _id: id, role: "jobseeker" })
      .select('-password -__v');
    
    if (!jobseeker) {
      return res.status(404).json({
        success: false,
        message: "Jobseeker not found"
      });
    }
    
    res.json({
      success: true,
      data: jobseeker
    });
  } catch (error) {
    console.error("Error fetching jobseeker:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching jobseeker",
      error: error.message
    });
  }
});

// Get individual employer by ID
router.get("/admin/users/employer/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const employer = await Employer.findOne({ _id: id })
      .select('-__v');
    
    if (!employer) {
      return res.status(404).json({
        success: false,
        message: "Employer not found"
      });
    }
    
    res.json({
      success: true,
      data: employer
    });
  } catch (error) {
    console.error("Error fetching employer:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching employer",
      error: error.message
    });
  }
});

// Block/Unblock user endpoint
router.patch("/admin/users/:userId/status", async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'active' or 'blocked'

    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "blocked"'
      });
    }

    // Try to find user in both collections
    let user = await FindrUser.findById(userId);
    let userType = 'jobseeker';
    
    if (!user) {
      user = await Employer.findById(userId);
      userType = 'employer';
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update the loginStatus
    user.loginStatus = status;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${status === 'blocked' ? 'blocked' : 'unblocked'} successfully`,
      data: {
        userId: user._id,
        userType,
        loginStatus: user.loginStatus
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
});

// Get user profile for admin "Know More" functionality
router.get("/admin/users/:userType/:id/profile", async (req, res) => {
  try {
    const { userType, id } = req.params;
    
    let user;
    if (userType === 'jobseeker') {
      user = await FindrUser.findById(id).select('-password -__v');
    } else if (userType === 'employer') {
      user = await Employer.findById(id).select('-__v');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching user profile',
      error: error.message
    });
  }
});

// Admin Services Endpoint - Get all services with pagination and filtering
router.get("/admin/services", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      buyerType = 'all',
      search = '',
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      status = 'all'
    } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build filter query
    const filterQuery = {};
    
    // Filter by buyer type
    if (buyerType !== 'all') {
      if (buyerType === 'jobseeker') {
        filterQuery.role = 'jobseeker';
      } else if (buyerType === 'employer') {
        filterQuery.role = 'employer';
      }
    }

    // Filter by status
    if (status !== 'all') {
      filterQuery.loginStatus = status;
    }

    // Add search functionality
    if (search) {
      filterQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    // Decide which collections to query based on buyerType
    const fetchJobseekers = buyerType === 'all' || buyerType === 'jobseeker';
    const fetchEmployers = buyerType === 'all' || buyerType === 'employer';

    const [jobseekers, employers] = await Promise.all([
      fetchJobseekers
        ? FindrUser.find({ 
            // force role to jobseeker regardless of outer filterQuery.role
            ...Object.fromEntries(Object.entries(filterQuery).filter(([k]) => k !== 'role')),
            role: 'jobseeker',
            $or: [
              { rmService: { $exists: true } },
              { 'orders.0': { $exists: true } }
            ]
          })
            .select('_id name fullName email phoneNumber location rmService orders loginStatus createdAt updatedAt')
            .sort({ [sortBy]: sortDirection })
            .lean()
        : Promise.resolve([]),
      fetchEmployers
        ? Employer.find({ 
            // ensure we do not carry role filter into employers query
            ...Object.fromEntries(Object.entries(filterQuery).filter(([k]) => k !== 'role')),
            $or: [
              { 'hrServices.0': { $exists: true } },
              { subscriptionPlan: { $ne: 'free' } },
              { subscriptionPlan: { $exists: true } }
            ]
          })
            .select('_id name companyName email phoneNumber industry hrServices subscriptionPlan subscriptionStatus subscriptionExpiry loginStatus createdAt updatedAt')
            .sort({ [sortBy]: sortDirection })
            .lean()
        : Promise.resolve([])
    ]);

    console.log('Found jobseekers:', jobseekers.length);
    console.log('Found employers:', employers.length);

    // Transform data to match frontend expectations
    const services = [];
    
    // Process jobseekers with RM services and orders
    jobseekers.forEach(user => {
      // Add RM Service if it exists (active or inactive)
      if (user.rmService) {
        const rmStatus = user.rmService === 'Active' ? 'active' : 'stopped';
        // Use updatedAt if RM service is active (likely when it was activated), otherwise use createdAt
        const rmServiceDate = (user.rmService === 'Active' && user.updatedAt) ? user.updatedAt : user.createdAt;
        services.push({
          _id: user._id.toString(),
          id: user._id.toString(),
          buyerName: user.fullName || user.name || 'N/A',
          buyerType: 'jobseeker',
          serviceName: 'RM Service',
          serviceType: 'Relationship Manager',
          orderDate: rmServiceDate,
          status: user.loginStatus === 'blocked' ? 'payment_pending' : rmStatus,
          amount: 0, // RM service might be free or points-based
          description: `RM Service for ${user.fullName || user.name}`,
          orderUrl: `/admin/users/jobseeker/${user._id}`,
          userEmail: user.email,
          userId: user._id.toString()
        });
      }
      
      // Add individual orders
      if (user.orders && user.orders.length > 0) {
        user.orders.forEach((order, index) => {
          let orderStatus = order.status;
          if (order.status === 'completed') {
            orderStatus = 'active';
          } else if (order.status === 'stopped' || order.status === 'suspended') {
            orderStatus = 'stopped';
          }
          services.push({
            _id: `${user._id}_order_${index}`,
            id: `${user._id}_order_${index}`,
            buyerName: user.fullName || user.name || 'N/A',
            buyerType: 'jobseeker',
            serviceName: order.service,
            serviceType: 'Premium Service',
            orderDate: order.orderDate || order.createdAt || new Date(),
            status: orderStatus,
            amount: order.totalAmount,
            description: `${order.service} for ${user.fullName || user.name}`,
            orderUrl: `/admin/users/jobseeker/${user._id}`,
            userEmail: user.email,
            userId: user._id.toString()
          });
        });
      }
    });
    
    // Process employers with HR services and subscriptions
    employers.forEach(employer => {
      // Add subscription plan if not free
      if (employer.subscriptionPlan && employer.subscriptionPlan !== 'free') {
        let subscriptionStatus = 'active';
        if (employer.subscriptionStatus === 'inactive' || employer.subscriptionStatus === 'expired') {
          subscriptionStatus = 'stopped';
        } else if (employer.subscriptionStatus !== 'active') {
          subscriptionStatus = 'payment_pending';
        }
        // Calculate subscription start date: use expiry date minus typical duration, or updatedAt, or createdAt
        let subscriptionStartDate = employer.createdAt;
        if (employer.subscriptionExpiry) {
          // Estimate start date based on expiry (assuming 1 month for basic, 3 months for premium, 12 months for enterprise)
          const durationMap = { basic: 1, premium: 3, enterprise: 12 };
          const months = durationMap[employer.subscriptionPlan] || 1;
          subscriptionStartDate = new Date(employer.subscriptionExpiry);
          subscriptionStartDate.setMonth(subscriptionStartDate.getMonth() - months);
        } else if (employer.updatedAt && employer.subscriptionStatus === 'active') {
          // If subscription is active and has updatedAt, use that as a better estimate
          subscriptionStartDate = employer.updatedAt;
        }
        
        services.push({
          _id: employer._id.toString(),
          id: employer._id.toString(),
          buyerName: employer.companyName || employer.name || 'N/A',
          buyerType: 'employer',
          serviceName: `${employer.subscriptionPlan.charAt(0).toUpperCase() + employer.subscriptionPlan.slice(1)} Subscription`,
          serviceType: 'Subscription Plan',
          orderDate: subscriptionStartDate,
          status: subscriptionStatus,
          amount: employer.subscriptionPlan === 'basic' ? 99 : employer.subscriptionPlan === 'premium' ? 299 : 599,
          description: `${employer.subscriptionPlan} subscription for ${employer.companyName || employer.name || 'Unknown Company'}`,
          orderUrl: `/admin/users/employer/${employer._id}`,
          userEmail: employer.email,
          userId: employer._id.toString()
        });
      }
      
      // Add HR services (active and stopped)
      if (employer.hrServices && employer.hrServices.length > 0) {
        employer.hrServices.forEach((service, index) => {
          let serviceStatus = service.status; // keep real state: 'active' | 'inactive'
          // If your UI expects 'suspended' as a distinct state, map pending -> suspended
          if (service.status === 'pending') {
            serviceStatus = 'suspended';
          }
          services.push({
            _id: `${employer._id}_hr_${index}`,
            id: `${employer._id}_hr_${index}`,
            buyerName: employer.companyName || employer.name || 'N/A',
            buyerType: 'employer',
            serviceName: service.serviceName.charAt(0).toUpperCase() + service.serviceName.slice(1).replace('_', ' '),
            serviceType: 'HR Service',
            orderDate: service.startDate || service.createdAt || employer.updatedAt || employer.createdAt,
            status: serviceStatus,
            amount: 199, // Default HR service amount
            description: `${service.serviceName} service for ${employer.companyName || employer.name || 'Unknown Company'}`,
            orderUrl: `/admin/users/employer/${employer._id}`,
            userEmail: employer.email,
            userId: employer._id.toString()
          });
        });
      }
    });

    // Sort combined results
    services.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      if (sortDirection === -1) {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Do not add any dummy data. Return empty results if none found.

    // Calculate total services count
    const totalServicesCount = services.length;
    
    // Debug logging
    console.log('Total services found:', totalServicesCount);
    console.log('Jobseekers with services:', jobseekers.length);
    console.log('Employers with services:', employers.length);
    
    // Apply pagination to combined results
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedServices = services.slice(startIndex, endIndex);

    // Calculate pagination info
    const totalPages = Math.ceil(totalServicesCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    console.log('Pagination info:', {
      currentPage: parseInt(page),
      totalPages,
      totalCount: totalServicesCount,
      hasNextPage,
      hasPrevPage,
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: paginatedServices,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount: totalServicesCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      },
      message: "Services data fetched successfully"
    });

  } catch (error) {
    console.error("Error fetching services data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching services data",
      error: error.message
    });
  }
});

// Admin Service Management - Stop/Resume Services
router.put("/admin/service-management/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status, userId, buyerType } = req.body;

    if (!['stopped', 'active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'stopped', 'active', or 'suspended'"
      });
    }

    if (buyerType === 'jobseeker') {
      // Handle jobseeker services (RM Service or orders)
      const user = await FindrUser.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Jobseeker not found"
        });
      }

      // Check if serviceId matches RM Service
      if (serviceId === userId) {
        // This is an RM Service
        user.rmService = status === 'active' ? 'Active' : 'Inactive';
        await user.save();

        return res.status(200).json({
          success: true,
          message: `RM Service ${status === 'active' ? 'resumed' : 'stopped'} successfully`,
          data: {
            serviceId,
            status: user.rmService
          }
        });
      } else if (serviceId.includes('_order_')) {
        // This is an order
        const orderIndex = parseInt(serviceId.split('_order_')[1]);
        if (user.orders && user.orders[orderIndex]) {
          user.orders[orderIndex].status = status === 'active' ? 'active' : 'stopped';
          await user.save();

          return res.status(200).json({
            success: true,
            message: `Service ${status === 'active' ? 'resumed' : 'stopped'} successfully`,
            data: {
              serviceId,
              status: user.orders[orderIndex].status
            }
          });
        }
      }
    } else if (buyerType === 'employer') {
      // Handle employer services (HR services or subscriptions)
      const employer = await Employer.findById(userId);
      if (!employer) {
        return res.status(404).json({
          success: false,
          message: "Employer not found"
        });
      }

      // Check if serviceId matches employer ID (subscription)
      if (serviceId === userId) {
        // This is a subscription plan
        employer.subscriptionStatus = status === 'active' ? 'active' : 'inactive';
        await employer.save();

        return res.status(200).json({
          success: true,
          message: `Subscription ${status === 'active' ? 'resumed' : 'stopped'} successfully`,
          data: {
            serviceId,
            status: employer.subscriptionStatus
          }
        });
      } else if (serviceId.includes('_hr_')) {
        // This is an HR service
        const hrIndex = parseInt(serviceId.split('_hr_')[1]);
        if (employer.hrServices && employer.hrServices[hrIndex]) {
          employer.hrServices[hrIndex].status = status === 'active' ? 'active' : status === 'suspended' ? 'inactive' : 'inactive';
          employer.markModified('hrServices');
          await employer.save();

          return res.status(200).json({
            success: true,
            message: `HR Service ${status === 'active' ? 'resumed' : 'stopped'} successfully`,
            data: {
              serviceId,
              status: employer.hrServices[hrIndex].status
            }
          });
        }
      }
    }

    return res.status(404).json({
      success: false,
      message: "Service not found"
    });

  } catch (error) {
    console.error("Error updating service status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating service status",
      error: error.message
    });
  }
});

router.get("/admin/grievances", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const grievances = await Grievance.find({})
      .populate('userId', 'name email fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Grievance.countDocuments({});

    res.json({
      success: true,
      data: {
        grievances,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch grievances",
      error: error.message
    });
  }
});

router.get("/admin/grievances/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const grievance = await Grievance.findById(id)
      .populate('userId', 'name email fullName');

    if (!grievance) {
      return res.status(404).json({ 
        success: false,
        message: "Grievance not found" 
      });
    }

    res.json({
      success: true,
      data: grievance
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch grievance",
      error: error.message
    });
  }
});

module.exports = router;
