const Job = require("../model/JobSchema");
const User = require("../model/UserSchemas");
const Application = require("../model/ApplicationSchema");
const Employer = require("../model/EmployerSchema");

// Create a new job
exports.createJob = async (req, res) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) {
      return res.status(401).json({ message: "Unauthorized. Please login as an employer." });
    }

    const jobData = {
      ...req.body,
      employer: employerId,
      status: "active" // Default status for new jobs
    };

    const newJob = new Job(jobData);
    await newJob.save();

    res.status(201).json({
      message: "Job created successfully",
      data: newJob
    });

    setImmediate(async () => {
      try {
        await Employer.findByIdAndUpdate(employerId, { $inc: { points: 30 } });
        
        const { sendJobPostedEmail, sendJobNotificationEmail } = require('../jobPost');
        const employer = await Employer.findById(employerId).select('email name companyName');
        const employerEmail = employer?.email;
        const employerName = employer?.name || employer?.companyName || 'Employer';
        const companyName = employer?.companyName || 'Company';
        
        if (employerEmail) {
          await sendJobPostedEmail(
            employerEmail,
            employerName,
            newJob.title,
            companyName,
            newJob._id.toString()
          );
        }

        // Send job notification emails to all job seekers
        const jobSeekers = await User.find({ role: 'jobseeker' }).select('email fullName name');
        const jobType = Array.isArray(newJob.jobType) ? newJob.jobType.join(', ') : newJob.jobType;
        
        const batchSize = 10;
        for (let i = 0; i < jobSeekers.length; i += batchSize) {
          const batch = jobSeekers.slice(i, i + batchSize);
          const emailPromises = batch.map(async (jobSeeker) => {
            if (jobSeeker.email) {
              try {
                await sendJobNotificationEmail(
                  jobSeeker.email,
                  jobSeeker.fullName || jobSeeker.name || 'Job Seeker',
                  newJob.title,
                  companyName,
                  newJob.location || 'Not specified',
                  jobType || 'Not specified',
                  newJob._id.toString()
                );
              } catch (err) {
                // Individual email error handled silently
              }
            }
          });
          
          await Promise.allSettled(emailPromises);
          
          if (i + batchSize < jobSeekers.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (err) {
        // Email error handled silently
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to create job", 
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
      return res.status(403).json({ message: "Not authorized to update this job" });
    }

    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { $set: req.body },
      { new: true }
    );

    res.status(200).json({
      message: "Job updated successfully",
      data: updatedJob
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to update job", 
      error: error.message 
    });
  }
};

// Get all jobs (with filters)
exports.getJobs = async (req, res) => {
  try {
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
    if (myJobs === 'true' && req.user?.id) {
      query.employer = req.user.id;
    }

    // Add filters if provided
    if (location) query.location = new RegExp(location, 'i');
    if (jobType) query.jobType = jobType;
    if (experienceLevel) query.experienceLevel = experienceLevel;
    if (industry) query.industry = new RegExp(industry, 'i');
    if (search) {
      query.$text = { $search: search };
    }

    const jobs = await Job.find(query)
      .populate('employer', 'companyName companyLocation companyDescription companyWebsite')
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
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to fetch jobs", 
      error: error.message 
    });
  }
};

// Get a single job
exports.getJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId)
      .populate('employer', 'companyName companyLocation companyDescription companyWebsite')
      .populate('applications');

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if the viewer is the job owner
    const viewerId = req.user?.id;
    const isOwner = viewerId && job.employer.toString() === viewerId;
    
    // If job is closed and viewer is not the owner, return 404
    if (job.status === 'closed' && !isOwner) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Increment view count only if viewer is not the job owner and job is active
    // This ensures employers don't inflate their own job view counts
    console.log('Job View - ViewerId:', viewerId, 'Job Owner:', job.employer.toString(), 'Is Owner:', isOwner);
    
    if (!isOwner && job.status === 'active') {
      job.views = (job.views || 0) + 1;
      await job.save();
      console.log('View count incremented to:', job.views);
    } else {
      console.log('View count NOT incremented (owner viewing own job or job not active)');
    }

    // Add application count for easy access
    const jobData = job.toObject();
    jobData.applicationCount = job.applications ? job.applications.length : 0;

    res.status(200).json({
      message: "Job fetched successfully",
      data: jobData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to fetch job", 
      error: error.message 
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
      return res.status(403).json({ message: "Not authorized to close this job" });
    }

    // Update job status to closed instead of deleting
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      { status: "closed" },
      { new: true }
    );

    res.status(200).json({
      message: "Job closed successfully",
      data: updatedJob
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to close job", 
      error: error.message 
    });
  }
};

// Get employer's own jobs
exports.getEmployerJobs = async (req, res) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) {
      return res.status(401).json({ message: "Unauthorized. Please login as an employer." });
    }

    const {
      status,
      page = 1,
      limit = 10,
      search,
    } = req.query;

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
      .populate('employer', 'companyName companyLocation companyDescription companyWebsite')
      .populate('applications')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Job.countDocuments(query);

    res.status(200).json({
      message: "Employer jobs fetched successfully",
      data: {
        jobs,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to fetch employer jobs", 
      error: error.message 
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
      return res.status(403).json({ message: "Not authorized to publish this job" });
    }

    job.status = "active";
    await job.save();

    res.status(200).json({
      message: "Job published successfully",
      data: job
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to publish job", 
      error: error.message 
    });
  }
};

// Get job recommendations for a user
exports.getJobRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 5 } = req.query;

    // Get user profile with all relevant fields for accurate matching
    const user = await User.findById(userId).select('skills location professionalExperience jobPreferences');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get jobs user has already applied to (excluding withdrawn applications)
    const appliedJobIds = await Application.find({ 
      applicantId: userId,
      status: { $ne: 'withdrawn' } // Exclude withdrawn applications
    }).distinct('jobId');

    // Build query for active jobs (excluding applied ones)
    let matchQuery = {
      status: 'active',
      _id: { $nin: appliedJobIds }
    };

    // Get all active jobs
    const jobs = await Job.find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) * 2); // Get more jobs for better scoring

    if (jobs.length === 0) {
      // If no jobs excluding applied ones, try getting any active jobs
      const allActiveJobs = await Job.find({ status: 'active' })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
      
      if (allActiveJobs.length === 0) {
        return res.json({
          message: "No job recommendations available",
          data: []
        });
      }

      // Use all active jobs as fallback, but filter by 70%+ match
      const fallbackJobs = allActiveJobs
        .map(job => ({
          ...job.toObject(),
          recommendationScore: calculateSimpleRecommendationScore(job, user)
        }))
        .filter(job => job.recommendationScore >= 70) // Only show 70-100% matches
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, parseInt(limit));

      return res.json({
        message: "Job recommendations retrieved successfully",
        data: fallbackJobs
      });
    }

    // Calculate recommendation scores
    const scoredJobs = jobs.map(job => {
      const score = calculateSimpleRecommendationScore(job, user);
      return {
        ...job.toObject(),
        recommendationScore: score
      };
    });

    // Filter jobs with 70% or higher match and sort by score
    const recommendedJobs = scoredJobs
      .filter(job => job.recommendationScore >= 70) // Only show 70-100% matches
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, parseInt(limit));

    // If no jobs meet the 70% threshold, return empty array with message
    if (recommendedJobs.length === 0) {
      return res.json({
        message: "No job recommendations available with 70% or higher match. Please complete your profile for better recommendations.",
        data: []
      });
    }

    res.json({
      message: "Job recommendations retrieved successfully",
      data: recommendedJobs
    });

  } catch (error) {
    console.error("Get job recommendations error:", error);
    res.status(500).json({ 
      message: "Failed to get job recommendations", 
      error: error.message 
    });
  }
};

// Improved recommendation scoring function with better accuracy
function calculateSimpleRecommendationScore(job, user) {
  try {
    let score = 0; // Start from 0 for more accurate scoring

    // 1. Skills match (35% weight) - Most important
    if (job.skills && Array.isArray(job.skills) && job.skills.length > 0) {
      if (user.skills && Array.isArray(user.skills) && user.skills.length > 0) {
        const jobSkills = job.skills.map(skill => String(skill).trim().toLowerCase()).filter(s => s.length > 0);
        const userSkills = user.skills.map(skill => String(skill).trim().toLowerCase()).filter(s => s.length > 0);
        
        // Only count meaningful skills (not single letters or invalid entries)
        const validJobSkills = jobSkills.filter(skill => skill.length > 1 && !/^[^a-z0-9]+$/.test(skill));
        const validUserSkills = userSkills.filter(skill => skill.length > 1 && !/^[^a-z0-9]+$/.test(skill));
        
        if (validJobSkills.length > 0 && validUserSkills.length > 0) {
          const matchingSkills = validJobSkills.filter(jobSkill => 
            validUserSkills.some(userSkill => {
              // Exact match or one contains the other (for variations like "java" and "java programming")
              return userSkill === jobSkill || 
                     (userSkill.length > 3 && jobSkill.length > 3 && 
                      (userSkill.includes(jobSkill) || jobSkill.includes(userSkill)));
            })
          );
          
          const skillMatchPercent = (matchingSkills.length / validJobSkills.length) * 35;
          score += skillMatchPercent;
        } else {
          // Penalty if user has invalid skills but job requires real skills (reduced penalty)
          score -= 5;
        }
      } else {
        // Penalty if job requires skills but user has none (reduced penalty)
        score -= 8;
      }
    }

    // 2. Experience level match (25% weight) - Check actual years of experience
    let userYearsExp = 0;
    
    // Get actual years of experience from user profile
    if (user.professionalExperience && Array.isArray(user.professionalExperience) && user.professionalExperience.length > 0) {
      const firstExp = user.professionalExperience[0];
      if (firstExp.yearsOfExperience) {
        userYearsExp = firstExp.yearsOfExperience;
      } else if (firstExp.experience) {
        // Handle string format like "10+ years", "2-3 years", etc.
        const expStr = String(firstExp.experience).toLowerCase();
        // Check for 10+ first (before checking for "10" which might match "1" or "0")
        if (expStr.includes('10+') || /^10/.test(expStr)) userYearsExp = 10;
        else if (expStr.includes('7-10') || /^7/.test(expStr)) userYearsExp = 7;
        else if (expStr.includes('4-6') || /^4/.test(expStr)) userYearsExp = 4;
        else if (expStr.includes('2-3') || /^2/.test(expStr)) userYearsExp = 2;
        else if (expStr.includes('0-1') || /^1/.test(expStr)) userYearsExp = 1;
      }
    }
    
    let expScore = 0;
    let jobExpLevel = '';
    
    // Check if job has experienceLevel field
    if (job.experienceLevel) {
      jobExpLevel = String(job.experienceLevel).toLowerCase();
    } else {
      // Try to extract from job description or requirements
      const jobText = ((job.description || '') + ' ' + (job.requirements || []).join(' ')).toLowerCase();
      if (jobText.includes('0-2 years') || jobText.includes('0 to 2 years') || jobText.includes('entry level') || jobText.includes('junior') || jobText.includes('intern')) {
        jobExpLevel = 'entry';
      } else if (jobText.includes('3-5 years') || jobText.includes('mid level') || jobText.includes('intermediate')) {
        jobExpLevel = 'mid';
      } else if (jobText.includes('5+ years') || jobText.includes('senior') || jobText.includes('lead') || jobText.includes('executive')) {
        jobExpLevel = 'senior';
      }
    }
    
    if (jobExpLevel.includes('entry') || jobExpLevel.includes('junior') || jobExpLevel.includes('intern')) {
      // Entry level: 0-2 years ideal, 3-4 acceptable, 5+ overqualified (but less penalty)
      if (userYearsExp <= 2) expScore = 25;
      else if (userYearsExp <= 4) expScore = 15;
      else if (userYearsExp <= 6) expScore = 8; // Overqualified but still acceptable
      else expScore = 5; // Significantly overqualified but don't penalize too much
    } else if (jobExpLevel.includes('mid') || jobExpLevel.includes('intermediate')) {
      // Mid level: 3-7 years ideal, 2 or 8-9 acceptable, 10+ overqualified
      if (userYearsExp >= 3 && userYearsExp <= 7) expScore = 25;
      else if (userYearsExp >= 2 && userYearsExp <= 9) expScore = 15;
      else if (userYearsExp >= 10) expScore = 8; // Overqualified but acceptable
      else expScore = 10; // Underqualified but acceptable
    } else if (jobExpLevel.includes('senior') || jobExpLevel.includes('lead') || jobExpLevel.includes('executive')) {
      // Senior level: 5+ years ideal, 3-4 acceptable, less than 3 underqualified
      if (userYearsExp >= 5) expScore = 25;
      else if (userYearsExp >= 3) expScore = 15;
      else expScore = 5; // Underqualified
    } else {
      // Unknown level - give moderate score based on user experience
      if (userYearsExp > 0) expScore = 15; // User has experience, give moderate score
      else expScore = 10; // No experience specified
    }
    
    score += expScore;

    // 3. Location match (20% weight) - Check both current location and preferred location
    if (job.location) {
      const jobLoc = String(job.location).toLowerCase();
      const userCurrentLoc = user.location ? String(user.location).toLowerCase() : '';
      const userPreferredLoc = user.jobPreferences?.preferredLocation ? 
        String(user.jobPreferences.preferredLocation).toLowerCase() : '';
      
      let locationMatch = false;
      
      // Check if job location matches user's preferred location (more important)
      if (userPreferredLoc && (jobLoc.includes(userPreferredLoc) || userPreferredLoc.includes(jobLoc))) {
        score += 20;
        locationMatch = true;
      }
      // Check if job location matches user's current location
      else if (userCurrentLoc && (jobLoc.includes(userCurrentLoc) || userCurrentLoc.includes(jobLoc))) {
        score += 15;
        locationMatch = true;
      }
      // Partial match (same city or region)
      else if (userPreferredLoc || userCurrentLoc) {
        const checkLoc = userPreferredLoc || userCurrentLoc;
        const jobWords = jobLoc.split(/[,\s]+/).filter(w => w.length > 2);
        const userWords = checkLoc.split(/[,\s]+/).filter(w => w.length > 2);
        const commonWords = jobWords.filter(word => userWords.includes(word));
        if (commonWords.length > 0) {
          score += 5; // Partial match
        } else {
          score -= 10; // Location mismatch penalty
        }
      }
    }

    // 4. Job type match (10% weight) - Check preferred job type
    if (job.jobType && Array.isArray(job.jobType) && job.jobType.length > 0) {
      const jobTypes = job.jobType.map(t => String(t).toLowerCase());
      const userPreferredTypes = user.jobPreferences?.preferredJobType || [];
      const userTypes = userPreferredTypes.map(t => String(t).toLowerCase());
      
      const hasMatch = jobTypes.some(jobType => 
        userTypes.some(userType => {
          // Normalize variations (e.g., "Part Time" vs "Part-time" vs "parttime")
          const normalizedJobType = jobType.replace(/[\s-]/g, '');
          const normalizedUserType = userType.replace(/[\s-]/g, '');
          return normalizedJobType === normalizedUserType || 
                 jobType.includes(userType) || 
                 userType.includes(jobType);
        })
      );
      
      if (hasMatch) {
        score += 10;
      } else {
        score -= 5; // Job type mismatch
      }
    }

    // 5. Salary expectation match (10% weight) - Check if salary is in acceptable range
    if (job.salary && user.jobPreferences?.salaryExpectation) {
      const jobMin = job.salary.min || 0;
      const jobMax = job.salary.max || 0;
      const jobAvg = (jobMin + jobMax) / 2;
      
      // Parse user's salary expectation (could be a range or single value)
      const userSalaryStr = String(user.jobPreferences.salaryExpectation).replace(/[^\d]/g, '');
      const userSalary = parseInt(userSalaryStr) || 0;
      
      if (userSalary > 0 && jobAvg > 0) {
        // If user expects more than 5x the job offers, it's a significant mismatch
        if (userSalary > jobMax * 5) {
          score -= 8; // Significant salary mismatch (reduced penalty)
        } else if (userSalary > jobMax * 3) {
          score -= 5; // Moderate salary mismatch (reduced penalty)
        } else if (userSalary > jobMax * 2) {
          score -= 2; // Minor salary mismatch
        } else if (userSalary >= jobMin * 0.8 && userSalary <= jobMax * 1.2) {
          score += 10; // Good salary match
        } else if (userSalary >= jobMin * 0.5) {
          score += 5; // Acceptable salary range
        } else {
          // User expects less than job minimum - might be underqualified or willing to accept lower
          score += 3; // Small bonus for flexibility
        }
      }
    }

    // 6. Recent job bonus (5% weight) - Less important
    if (job.createdAt) {
      const daysSincePosted = (new Date() - new Date(job.createdAt)) / (1000 * 60 * 60 * 24);
      if (daysSincePosted <= 7) {
        score += 5;
      } else if (daysSincePosted <= 30) {
        score += 2;
      }
    }

    // Ensure score is between 0 and 100 and round properly
    const finalScore = Math.max(0, Math.min(score, 100));
    // Round to integer for display
    return Math.round(finalScore);
  } catch (error) {
    console.error("Error calculating recommendation score:", error);
    console.error("Job ID:", job?._id, "User ID:", user?._id);
    return 0; // Return 0 on error instead of 50
  }
}
