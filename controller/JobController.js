const Job = require("../model/JobSchema");
const User = require("../model/UserSchemas");
const {
  expireJobsPastApplicationDeadline,
  utcStartOfDay,
} = require("../utils/expireJobsByDeadline");
const Application = require("../model/ApplicationSchema");
const Employer = require("../model/EmployerSchema");
const ReferralInvite = require("../model/ReferralInviteSchema");
const {
  syncEmployerJobPostingLimit,
  hasJobPostingSlot,
  getJobPostingStatus,
  getEffectiveJobPostingLimit,
} = require("../utils/employerJobPosting");

exports.createJob = async (req, res) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) {
      return res
        .status(401)
        .json({ message: "Unauthorized. Please login as an employer." });
    }

    let employer = await Employer.findById(employerId);
    if (!employer) {
      return res.status(404).json({ message: "Employer not found." });
    }

    employer = await syncEmployerJobPostingLimit(employer);

    if (!hasJobPostingSlot(employer)) {
      const jobPosting = getJobPostingStatus(employer);
      return res.status(403).json({
        message:
          jobPosting.canUnlockWithPoints
            ? `You have used your job posting slot. Spend ${jobPosting.pointsCost} points to post another job, or wait ${jobPosting.daysUntilFreeSlot} day(s) for a free slot.`
            : `You have used your job posting slot. Wait ${jobPosting.daysUntilFreeSlot} day(s) for your next free post, or earn ${jobPosting.pointsCost} points to unlock another job.`,
        code: "JOB_POSTING_LIMIT_REACHED",
        jobPosting,
      });
    }

    const { title, location, experienceLevel } = req.body;
    const company = req.body.companyName || req.body.company;

    const existingJob = await Job.findOne({
      title,
      companyName: company,
      location,
      experienceLevel
    });

    if (existingJob) {
      return res.status(409).json({
        message: "Job already exists"
      });
    }

    let salaryAmount = req.body.salary;
    if (req.body.salary && typeof req.body.salary === "object") {
      if (req.body.salary.min !== undefined) {
        salaryAmount = req.body.salary.min;
      } else if (req.body.salary.max !== undefined) {
        salaryAmount = req.body.salary.max;
      } else if (req.body.salary.amount !== undefined) {
        salaryAmount = req.body.salary.amount;
      }
    }

    const jobData = {
      ...req.body,
      salary: salaryAmount,
      employer: employerId,
      status: "active", 
    };

    const newJob = new Job(jobData);
    await newJob.save();

    employer.jobPostingLimit = Math.max(0, getEffectiveJobPostingLimit(employer) - 1);
    employer.lastJobPostedAt = new Date();
    await employer.save();

    res.status(201).json({
      message: "Job created successfully",
      data: newJob,
      jobPosting: getJobPostingStatus(employer),
    });

    setImmediate(async () => {
      try {
        await Employer.findByIdAndUpdate(employerId, { $inc: { points: 100 } });

        try {
          const Reward = require("../model/RewardSchema");
          const rewardTx = new Reward({
            userId: employerId,
            userModel: "Employer",
            rewardType: "activity",
            points: 100,
            rewardHistory: [{
              description: `Posted a job: ${newJob.title}`,
              date: new Date(),
              points: 100
            }]
          });
          await rewardTx.save();
        } catch (logErr) {
          console.error("Failed to log job posting reward transaction:", logErr);
        }

        const {
          sendJobPostedEmail,
          sendJobNotificationEmail,
        } = require("../jobPost");
        const employer = await Employer.findById(employerId).select(
          "email name companyName",
        );
        const employerEmail = employer?.email;
        const employerName =
          employer?.name || employer?.companyName || "Employer";
        const companyName = employer?.companyName || "Company";

        if (employerEmail) {
          await sendJobPostedEmail(
            employerEmail,
            employerName,
            newJob.title,
            companyName,
            newJob._id.toString(),
          );
        }

        // Send job notification emails to all job seekers
        const jobSeekers = await User.find({ role: "jobseeker" }).select(
          "email fullName name",
        );
        const jobType = Array.isArray(newJob.jobType)
          ? newJob.jobType.join(", ")
          : newJob.jobType;

        const batchSize = 10;
        for (let i = 0; i < jobSeekers.length; i += batchSize) {
          const batch = jobSeekers.slice(i, i + batchSize);
          const emailPromises = batch.map(async (jobSeeker) => {
            if (jobSeeker.email) {
              try {
                await sendJobNotificationEmail(
                  jobSeeker.email,
                  jobSeeker.fullName || jobSeeker.name || "Job Seeker",
                  newJob.title,
                  companyName,
                  newJob.location || "Not specified",
                  jobType || "Not specified",
                  newJob._id.toString(),
                );
              } catch (err) {
              }
            }
          });

          await Promise.allSettled(emailPromises);

          if (i + batchSize < jobSeekers.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      } catch (err) {
      }
    });
  } catch (error) {
    console.error("createJob Error Detail:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Please fill in all required fields before posting your job.",
        errors: error.errors ? Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`) : [error.message]
      });
    }

    res.status(500).json({
      message: "We could not post your job right now. Please try again in a few minutes.",
      error: error.message
    });
  }
};

// Update a job
exports.updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employerId = req.user?.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if the user is the job owner
    if (job.employer.toString() !== employerId) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this job" });
    }

    // Handle salary: convert from min/max object to single amount if needed
    const updateData = { ...req.body };
    if (req.body.salary && typeof req.body.salary === "object") {
      // If salary is an object with min/max, use min (or average if both exist)
      if (req.body.salary.min !== undefined) {
        updateData.salary = req.body.salary.min;
      } else if (req.body.salary.max !== undefined) {
        updateData.salary = req.body.salary.max;
      } else if (req.body.salary.amount !== undefined) {
        updateData.salary = req.body.salary.amount;
      }
    }

    // If deadline is extended to today or later (UTC calendar day), reactivate expired jobs
    if (updateData.applicationDeadline !== undefined) {
      const parsed = new Date(updateData.applicationDeadline);
      if (!Number.isNaN(parsed.getTime())) {
        const deadlineDay = utcStartOfDay(parsed);
        const todayStart = utcStartOfDay(new Date());
        if (deadlineDay >= todayStart && job.status === "expired") {
          updateData.status = "active";
        }
      }
    }

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { $set: updateData },
      { new: true },
    );

    res.status(200).json({
      message: "Job updated successfully",
      data: updatedJob,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update job",
      error: error.message,
    });
  }
};
exports.getJobsForPicker = async (req, res) => {
  try {
    await expireJobsPastApplicationDeadline();

    const { search = "", page = 1, limit = 8, candidateEmail } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));

    const query = { status: "active" };
    if (search && search.trim()) {
      const pattern = new RegExp(search.trim(), "i");
      query.$or = [
        { title: pattern },
        { companyName: pattern },
        { location: pattern },
      ];
    }

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .select("title companyName location jobType salary _id")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(query),
    ]);

    // When candidateEmail + authenticated user: mark jobs already referred by this user for this candidate
    if (candidateEmail && candidateEmail.trim() && req.user?.id) {
      const normalizedEmail = candidateEmail.trim().toLowerCase();
      const jobIds = jobs.map((j) => j._id);
      const referredJobIds = await ReferralInvite.find({
        referrerId: req.user.id,
        email: normalizedEmail,
        jobId: { $in: jobIds },
        status: { $in: ["pending", "approved"] },
      }).distinct("jobId");
      const referredSet = new Set(referredJobIds.map((id) => id.toString()));
      jobs.forEach((j) => {
        j.alreadyReferred = referredSet.has(j._id.toString());
      });
    } else {
      jobs.forEach((j) => { j.alreadyReferred = false; });
    }

    res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          total,
          pages: Math.ceil(total / limitNum),
          page: pageNum,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("getJobsForPicker", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
      error: error.message,
    });
  }
};

// Get all jobs (with filters)
exports.getJobs = async (req, res) => {
  try {
    await expireJobsPastApplicationDeadline();

    const {
      location,
      jobType,
      experienceLevel,
      industry,
      status = "active",
      page = 1,
      limit = 10,
      search,
      myJobs, // New parameter to filter employer's own jobs
    } = req.query;

    const query = { status };

    // If myJobs=true and user is authenticated, filter by employer
    if (myJobs === "true" && req.user?.id) {
      query.employer = req.user.id;
    }

    // Add filters if provided
    if (location) query.location = new RegExp(location, "i");
    if (jobType) query.jobType = jobType;
    if (experienceLevel) query.experienceLevel = experienceLevel;
    if (industry) query.industry = new RegExp(industry, "i");
    if (search) {
      query.$text = { $search: search };
    }

    const jobs = await Job.find(query)
      .populate(
        "employer",
        "companyName companyLocation companyDescription companyWebsite",
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Job.countDocuments(query);

    res.status(200).json({
      message: "Jobs fetched successfully",
      data: {
        jobs,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch jobs",
      error: error.message,
    });
  }
};

// Get a single job
exports.getJob = async (req, res) => {
  try {
    await expireJobsPastApplicationDeadline();

    const { jobId } = req.params;

    const job = await Job.findById(jobId)
      .populate(
        "employer",
        "companyName companyLocation companyDescription companyWebsite",
      )
      .populate("applications");

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if the viewer is the job owner (employer may be populated)
    const viewerId = req.user?.id;
    const rawEmployer = job.employer;
    const ownerId =
      rawEmployer &&
      typeof rawEmployer === "object" &&
      rawEmployer._id
        ? rawEmployer._id.toString()
        : String(rawEmployer);
    const isOwner = Boolean(viewerId && ownerId === viewerId);

    // If job is closed/expired and viewer is not the owner, return 404
    if (
      (job.status === "closed" || job.status === "expired") &&
      !isOwner
    ) {
      return res.status(404).json({ message: "Job not found" });
    }


    if (!isOwner && job.status === "active") {
      await Job.findByIdAndUpdate(jobId, { $inc: { views: 1 } });
      job.views = (job.views || 0) + 1;
      console.log("View count incremented to:", job.views);
    } else {
      console.log(
        "View count NOT incremented (owner viewing own job or job not active)",
      );
    }

    // Add application count for easy access
    const jobData = job.toObject();
    jobData.applicationCount = job.applications ? job.applications.length : 0;

    res.status(200).json({
      message: "Job fetched successfully",
      data: jobData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch job",
      error: error.message,
    });
  }
};

// Close a job (replaces delete functionality)
exports.closeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employerId = req.user?.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if the user is the job owner
    if (job.employer.toString() !== employerId) {
      return res
        .status(403)
        .json({ message: "Not authorized to close this job" });
    }

    // Update job status to closed instead of deleting
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { status: "closed" },
      { new: true },
    );

    res.status(200).json({
      message: "Job closed successfully",
      data: updatedJob,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to close job",
      error: error.message,
    });
  }
};

// Get employer's own jobs
exports.getEmployerJobs = async (req, res) => {
  try {
    await expireJobsPastApplicationDeadline();

    const employerId = req.user?.id;
    if (!employerId) {
      return res
        .status(401)
        .json({ message: "Unauthorized. Please login as an employer." });
    }

    const { status, page, limit, search } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 9;

    const query = { employer: employerId };
    // Only filter by status if explicitly provided
    if (status) {
      query.status = status;
    }

    // Add search if provided
    if (search) {
      query.$text = { $search: search };
    }

    const jobs = await Job.find(query)
      .populate(
        "employer",
        "companyName companyLocation companyDescription companyWebsite",
      )
      .populate("applications")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Job.countDocuments(query);

    res.status(200).json({
      message: "Employer jobs fetched successfully",
      data: {
        jobs,
        pagination: {
          total,
          pages: Math.ceil(total / limitNum),
          page: pageNum,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch employer jobs",
      error: error.message,
    });
  }
};

// Publish a job
exports.publishJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employerId = req.user?.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if the user is the job owner
    if (job.employer.toString() !== employerId) {
      return res
        .status(403)
        .json({ message: "Not authorized to publish this job" });
    }

    job.status = "active";
    await job.save();

    res.status(200).json({
      message: "Job published successfully",
      data: job,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to publish job",
      error: error.message,
    });
  }
};


