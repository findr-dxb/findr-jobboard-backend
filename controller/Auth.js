const User = require("../model/UserSchemas");
const Employer = require("../model/EmployerSchema");
const ProfileAccessRequest = require("../model/ProfileAccessRequestSchema");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();


const generateReferralCode = (userName) => {
  const namePart = userName
    .replace(/[^a-zA-Z]/g, '') 
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X'); 
  
  const randomNum = Math.floor(Math.random() * 90) + 10;
  
  return `FINDR${namePart}${randomNum}`;
};

exports.signup = async (req, res) => {
  try {
    const { email, password, role, referralCode, ...otherData } = req.body;

    // Validate role
    if (role !== "jobseeker" && role !== "employer") {
      return res.status(400).json({ 
        message: "Role must be either 'jobseeker' or 'employer'" 
      });
    }

    // Check if user already exists in either collection
    const existingUser = role === "employer" 
      ? await Employer.findOne({ email })
      : await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ 
        message: "Account with this email already exists" 
      });
    }

    // Handle referral code if provided
    let referredBy = null;
    if (referralCode && referralCode.trim() !== '') {
      // Find the user with this referral code (only from User collection, not Employer)
      const referringUser = await User.findOne({ 
        referralCode: referralCode.trim().toUpperCase() 
      });
      
      if (referringUser) {
        referredBy = referringUser._id;
      } else {
        // Referral code is invalid, but we'll still create the account
        // You can choose to return an error here if you want strict validation
      }
    }

    // Create new user based on role
    const Model = role === "employer" ? Employer : User;
    const userName = otherData.name || otherData.fullName || email.split('@')[0];
    
    // Generate referral code for new user
    const newUserReferralCode = generateReferralCode(userName);
    
    const userData = {
      email,
      password,
      role,
      name: userName,
      referralCode: newUserReferralCode, // Add referral code explicitly during signup
      ...(referredBy && { referredBy }), // Add referredBy if referral code was valid
      ...(role === "employer" ? otherData : { ...otherData, fullName: otherData.name })
    };
    let newUser = new Model(userData);

    await newUser.save();

    // Award multiplied points to referrer if someone signed up using their referral code
    if (referredBy) {
      try {
        // Fetch referrer's profile to calculate their tier multiplier
        const referrer = await User.findById(referredBy);
        
        if (!referrer) {
          console.error('[ReferralSignupPoints] Referrer not found:', referredBy);
          return;
        }

        // Calculate referrer's profile completion to determine tier
        let completed = 0;
        const totalFields = 24;

        // Personal Info (9 fields)
        if (referrer.fullName) completed++;
        if (referrer.email) completed++;
        if (referrer.phoneNumber) completed++;
        if (referrer.location) completed++;
        if (referrer.dateOfBirth) completed++;
        if (referrer.nationality) completed++;
        if (referrer.professionalSummary) completed++;
        if (referrer.emirateId) completed++;
        if (referrer.passportNumber) completed++;

        // Experience (4 fields)
        if (referrer.professionalExperience && referrer.professionalExperience.length > 0) {
          const exp = referrer.professionalExperience[0];
          if (exp?.currentRole) completed++;
          if (exp?.company) completed++;
          if (exp?.yearsOfExperience) completed++;
          if (exp?.industry) completed++;
        }

        // Education (4 fields)
        if (referrer.education && referrer.education.length > 0) {
          const edu = referrer.education[0];
          if (edu?.highestDegree) completed++;
          if (edu?.institution) completed++;
          if (edu?.yearOfGraduation) completed++;
          if (edu?.gradeCgpa) completed++;
        }

        // Skills, Preferences, Certifications, Resume (4 fields)
        if (referrer.skills && referrer.skills.length > 0) completed++;
        if (referrer.jobPreferences?.preferredJobType && referrer.jobPreferences.preferredJobType.length > 0) completed++;
        if (referrer.certifications && referrer.certifications.length > 0) completed++;
        if (referrer.jobPreferences?.resumeAndDocs && referrer.jobPreferences.resumeAndDocs.length > 0) completed++;

        // Social Links (3 fields)
        if (referrer.socialLinks?.linkedIn) completed++;
        if (referrer.socialLinks?.instagram) completed++;
        if (referrer.socialLinks?.twitterX) completed++;

        // Helper functions for tier multiplier calculation
        const getExperienceLevel = (yearsExp) => {
          if (yearsExp <= 1) return 'Blue';
          else if (yearsExp >= 2 && yearsExp <= 5) return 'Silver';
          else return 'Gold'; // 5+ years
        };

        const getTierMultiplier = (tier, experienceLevel) => {
          const A = 1.0;
          if (tier === 'Platinum') {
            if (experienceLevel === 'Blue') return 2.0;
            else if (experienceLevel === 'Silver') return 3.0;
            else return 4.0;
          } else if (tier === 'Gold') return 2.0 * A;
          else if (tier === 'Silver') return 1.5 * A;
          else return 1.0 * A;
        };

        const determineUserTier = (basePoints, yearsExp, isEmirati) => {
          if (isEmirati) return "Platinum";
          else if (basePoints >= 500) return "Platinum";
          else if (yearsExp >= 5) return "Gold";
          else if (yearsExp >= 2 && yearsExp <= 5) return "Silver";
          else return "Blue";
        };

        // Calculate referrer's base points and tier
        const percentage = Math.round((completed / totalFields) * 100);
        const basePoints = 50 + (percentage * 2);
        const yearsExp = referrer?.professionalExperience?.[0]?.yearsOfExperience || 0;
        const isEmirati = referrer?.nationality?.toLowerCase()?.includes("emirati");
        const experienceLevel = getExperienceLevel(yearsExp);
        const tier = determineUserTier(basePoints, yearsExp, isEmirati);
        
        // Get tier multiplier
        const multiplier = getTierMultiplier(tier, experienceLevel);
        
        // Calculate multiplied referral points (base 50 points × multiplier)
        const baseReferralPoints = 50;
        const multipliedReferralPoints = Math.round(baseReferralPoints * multiplier);

        // Award multiplied points to referrer
        const updateResult = await User.findByIdAndUpdate(referredBy, {
          $inc: { 
            "points": multipliedReferralPoints,
            "referralRewardPoints": multipliedReferralPoints,
            "rewards.totalPoints": multipliedReferralPoints,
            "rewards.referFriend": multipliedReferralPoints
          }
        }, { new: true });
        
        if (updateResult) {
          console.log('[ReferralSignupPoints] Successfully awarded multiplied points to referrer for signup:', referredBy, {
            baseReferralPoints: baseReferralPoints,
            multiplier: multiplier,
            tier: tier,
            experienceLevel: experienceLevel,
            multipliedReferralPoints: multipliedReferralPoints,
            newReferralRewardPoints: updateResult.referralRewardPoints,
            newReferFriendPoints: updateResult.rewards?.referFriend,
            newPoints: updateResult.points,
            newUserEmail: email
          });
        } else {
          console.error('[ReferralSignupPoints] User not found for referrer ID:', referredBy);
        }
      } catch (referralErr) {
        console.error('[ReferralSignupPoints] Failed to award referral signup points:', {
          error: referralErr.message,
          stack: referralErr.stack,
          referrerId: referredBy,
          newUserEmail: email
        });
      }
    }

    
    if (role === "jobseeker") {
      let completed = 0;
      const totalFields = 24;

      if (newUser.fullName || newUser.name) completed++;
      if (newUser.email) completed++;
      if (newUser.phoneNumber) completed++;
      if (newUser.location) completed++;
      if (newUser.dateOfBirth) completed++;
      if (newUser.nationality) completed++;
      if (newUser.professionalSummary) completed++;
      if (newUser.emirateId) completed++;
      if (newUser.passportNumber) completed++;
      
      const exp = newUser.professionalExperience?.[0];
      if (exp?.currentRole) completed++;
      if (exp?.company) completed++;
      if (exp?.yearsOfExperience) completed++;
      if (exp?.industry) completed++;
      
      const edu = newUser.education?.[0];
      if (edu?.highestDegree) completed++;
      if (edu?.institution) completed++;
      if (edu?.yearOfGraduation) completed++;
      if (edu?.gradeCgpa) completed++;
      
      if (newUser.skills && newUser.skills.length > 0) completed++;
      if (newUser.jobPreferences?.preferredJobType && newUser.jobPreferences.preferredJobType.length > 0) completed++;
      if (newUser.certifications && newUser.certifications.length > 0) completed++;
      if (newUser.jobPreferences?.resumeAndDocs && newUser.jobPreferences.resumeAndDocs.length > 0) completed++;
      
      if (newUser.socialLinks?.linkedIn) completed++;
      if (newUser.socialLinks?.instagram) completed++;
      if (newUser.socialLinks?.twitterX) completed++;

      const percentage = Math.round((completed / totalFields) * 100);
      const calculatedPoints = 50 + percentage * 2;
      
      newUser.rewards.totalPoints = calculatedPoints;
      newUser.points = calculatedPoints;
      newUser.rewards.completeProfile = percentage;
      await newUser.save();
      
      newUser = await Model.findById(newUser._id);
    }

    const token = jwt.sign(
      { 
        id: newUser._id,
        role: newUser.role 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

   
    const userProfile = newUser.getPublicProfile();

    res.status(201).json({
      message: "Registration successful",
      user: {
        ...userProfile,
        points: role === "jobseeker" ? userProfile.rewards?.totalPoints || 0 : undefined,
        profileCompletion: role === "jobseeker" ? userProfile.rewards?.completeProfile || 0 : undefined,
      },
      token
    });

    setImmediate(async () => {
      try {
        const { sendWelcomeEmail } = require('../welcomeMail');
        const userName = role === "jobseeker" 
          ? (newUser.fullName || newUser.name || 'User')
          : (newUser.name || newUser.companyName || 'User');
        
        const emailResult = await sendWelcomeEmail(email, userName, role);
        if (!emailResult.success) {
          console.error('Welcome email failed:', emailResult.error);
        }
      } catch (err) {
        console.error('Welcome email error:', err.message);
      }
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Registration failed", 
      error: error.message 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    if (role !== "jobseeker" && role !== "employer") {
      return res.status(400).json({ 
        message: "Role must be either 'jobseeker' or 'employer'" 
      });
    }

    if (role !== "jobseeker" && role !== "employer") {
      return res.status(400).json({ 
        message: "Role must be either 'jobseeker' or 'employer'" 
      });
    }

    // Find user based on role
    const Model = role === "employer" ? Employer : User;
    const user = await Model.findOne({ email });

    if (!user) {
      return res.status(401).json({ 
        message: "Invalid credentials" 
      });
    }

    // Check if user is blocked
    if (user.loginStatus === 'blocked') {
      return res.status(403).json({ 
        message: "Your account has been blocked. Please contact support.",
        blocked: true 
      });
    }

    // Direct password comparison
    if (user.password !== password) {
      return res.status(401).json({ 
        message: "Invalid credentials" 
      });
    }

    console.log("Login Response User:", user); // Add this for debugging

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        role: user.role 
      }, 
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Get public profile (excludes password)
    const userProfile = user.getPublicProfile();

    // Ensure name is always present in the response
    const name = userProfile.name || userProfile.fullName || email.split('@')[0];

    res.status(200).json({
      message: "Login successful",
      user: {
        ...userProfile,
        name, // Always include name
        points: role === "jobseeker" ? userProfile.rewards?.totalPoints || 0 : undefined,
        profileCompletion: role === "jobseeker" ? userProfile.rewards?.completeProfile || 0 : undefined,
      },
      token
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Login failed", 
      error: error.message 
    });
  }
};

// Update Profile
// Complete employer profile
exports.completeEmployerProfile = async (req, res) => {
  try {
    const {
      companyName,
      industry,
      companySize,
      companyLocation,
      contactPerson,
      companyDescription,
      website,
      socialLinks,
    } = req.body;

    // Get employer ID from token
    const employerId = req.user?.id;
    if (!employerId) {
      return res.status(401).json({ message: "Unauthorized. Please login first." });
    }

    // Find employer and update profile
    const updatedEmployer = await Employer.findByIdAndUpdate(
      employerId,
      {
        $set: {
          companyName,
          industry,
          companySize,
          companyLocation,
          contactPerson,
          companyDescription,
          website,
          socialLinks,
          verificationStatus: "pending", // Set to pending for admin review
        }
      },
      { new: true }
    );

    if (!updatedEmployer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    res.status(200).json({
      message: "Employer profile completed successfully",
      user: updatedEmployer.getPublicProfile()
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Failed to complete profile", 
      error: error.message 
    });
  }
};

// Update jobseeker profile
// Get User Profile Details
// exports.getUserProfileDetails = async (req, res) => {
//   try {
//     const userId = req.user?.id;
//     if (!userId) {
//       return res.status(401).json({ message: "Unauthorized. Please login first." });
//     }

//     const user = await User.findById(userId).select('name email points profileCompleted membershipTier profilePicture');
    
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json({
//       success: true,
//       data: {
//         name: user.name,
//         email: user.email,
//         points: user.points || 0,
//         profileCompleted: user.profileCompleted || "0",
//         membershipTier: user.membershipTier || "Blue",
//         profilePicture: user.profilePicture || ""
//       }
//     });

//   } catch (error) {
//     console.error("Get profile details error:", error);
//     res.status(500).json({ 
//       success: false,
//       message: "Failed to fetch profile details",
//       error: error.message 
//     });
//   }
// };

exports.getUserProfileDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please login first." });
    }

    // Find user based on role
    let user;
    if (userRole === 'employer') {
      user = await Employer.findById(userId).select('-password');
    } else {
      user = await User.findById(userId).select('-password');
    }
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const publicProfile = user.getPublicProfile ? user.getPublicProfile() : user.toObject();

    // Recalculate awaitingFeedback count to ensure accuracy (only for jobseekers)
    if (userRole !== 'employer') {
      const Application = require("../model/ApplicationSchema");
      const viewedApplicationsCount = await Application.countDocuments({
        applicantId: userId,
        viewedByEmployer: true
      });
      
      // Update the user's awaitingFeedback count if it's different
      if (publicProfile.applications?.awaitingFeedback !== viewedApplicationsCount) {
        await User.findByIdAndUpdate(userId, {
          'applications.awaitingFeedback': viewedApplicationsCount
        });
        // Update the publicProfile object
        if (!publicProfile.applications) publicProfile.applications = {};
        publicProfile.applications.awaitingFeedback = viewedApplicationsCount;
      }
    }

    // Build response data based on role
    const responseData = {
      email: publicProfile.email,
      role: publicProfile.role || userRole,
      name: publicProfile.name || "",
      points: publicProfile.points || 0,
      membershipTier: publicProfile.membershipTier || "Blue",
      linkedIn: user.linkedIn || false,
      instagram: user.instagram || false,
    };

    // Add role-specific fields
    if (userRole === 'employer') {
      // Employer-specific fields
      responseData.companyName = publicProfile.companyName || "";
      responseData.profilePhoto = publicProfile.profilePhoto || "";
      responseData.socialLinks = {
        linkedin: publicProfile.socialLinks?.linkedin || "",
        twitter: publicProfile.socialLinks?.twitter || "",
        facebook: publicProfile.socialLinks?.facebook || "",
      };
      responseData.rewards = {
        completeProfile: publicProfile.rewards?.completeProfile || 0,
        applyForJobs: publicProfile.rewards?.applyForJobs || 0,
        referFriend: publicProfile.rewards?.referFriend || 0,
        totalPoints: publicProfile.rewards?.totalPoints || 0,
        socialMediaBonus: publicProfile.rewards?.socialMediaBonus || 0,
      };
    } else {
      // Jobseeker-specific fields
      responseData.profilePicture = publicProfile.profilePicture || "";
      responseData.fullName = publicProfile.fullName || "";
      responseData.phoneNumber = publicProfile.phoneNumber || "";
      responseData.location = publicProfile.location || "";
      responseData.dateOfBirth = publicProfile.dateOfBirth || null;
      responseData.nationality = publicProfile.nationality || "";
      responseData.emirateId = publicProfile.emirateId || "";
      responseData.passportNumber = publicProfile.passportNumber || "";
      responseData.introVideo = publicProfile.introVideo || "";
      responseData.resumeDocument = publicProfile.resumeDocument || "";
      responseData.professionalSummary = publicProfile.professionalSummary || "";
      responseData.refersLink = publicProfile.refersLink || "";
      responseData.referredMember = publicProfile.referredMember || "";
      responseData.professionalExperience = publicProfile.professionalExperience || [];
      responseData.education = publicProfile.education || [];
      responseData.skills = publicProfile.skills || [];
      responseData.certifications = publicProfile.certifications || [];
      responseData.jobPreferences = {
        preferredJobType: publicProfile.jobPreferences?.preferredJobType || [],
        salaryExpectation: publicProfile.jobPreferences?.salaryExpectation || "",
        preferredLocation: publicProfile.jobPreferences?.preferredLocation || "",
        availability: publicProfile.jobPreferences?.availability || "",
        resumeAndDocs: publicProfile.jobPreferences?.resumeAndDocs || [],
      };
      responseData.socialLinks = {
        linkedIn: publicProfile.socialLinks?.linkedIn || "",
        instagram: publicProfile.socialLinks?.instagram || "",
        twitterX: publicProfile.socialLinks?.twitterX || "",
      };
      responseData.rmService = publicProfile.rmService || "Inactive";
      responseData.rewards = {
        completeProfile: publicProfile.rewards?.completeProfile || 0,
        applyForJobs: publicProfile.rewards?.applyForJobs || 0,
        referFriend: publicProfile.rewards?.referFriend || 0,
        rmService: publicProfile.rewards?.rmService || 0,
        totalPoints: publicProfile.rewards?.totalPoints || 0,
      };
      responseData.referralRewardPoints = publicProfile.referralRewardPoints || 0;
      responseData.applications = {
        totalApplications: publicProfile.applications?.totalApplications || 0,
        activeApplications: publicProfile.applications?.activeApplications || 0,
        awaitingFeedback: publicProfile.applications?.awaitingFeedback || 0,
        appliedJobs: publicProfile.applications?.appliedJobs || [],
      };
      responseData.savedJobs = publicProfile.savedJobs || [];
      responseData.profileCompleted = publicProfile.profileCompleted || "0";
      responseData.deductedPoints = publicProfile.deductedPoints || 0;
      responseData.referralCode = publicProfile.referralCode || user.referralCode || "";
    }

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch profile details",
      error: error.message 
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      location,
      dateOfBirth,
      nationality,
      emirateId,
      passportNumber,
      employmentVisa,
      visaExpiryDate,
      introVideo,
      professionalSummary,

      // Professional Experience
      professionalExperience,

      // Education
      education,

      // Skills & Certifications
      skills,
      certifications,

      // Job Preferences
      jobPreferences,

      // Social Media Links
      socialLinks,
      
      // Profile Picture
      profilePicture,
      
      // Resume Document
      resumeDocument,
    } = req.body;

    // Validate Emirates ID if provided: exactly 15 digits
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'emirateId')) {
      const emirateIdStr = (req.body.emirateId ?? '').toString().trim();
      if (emirateIdStr && !/^\d{15}$/.test(emirateIdStr)) {
        return res.status(400).json({ message: "Invalid Emirates ID. It must be exactly 15 digits." });
      }
    }

    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'nationality')) {
      const nationalityStr = (req.body.nationality ?? '').toString().trim().toLowerCase();
      const isEmirati = nationalityStr.includes("emirati") || nationalityStr.includes("uae");
      
      if (!isEmirati && nationalityStr) {
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'visaExpiryDate')) {
          const visaExpiryDateStr = (req.body.visaExpiryDate ?? '').toString().trim();
          if (!visaExpiryDateStr || visaExpiryDateStr === '') {
            return res.status(400).json({ message: "Visa Expiry Date is required for non-Emirati users." });
          }
        } else {
          return res.status(400).json({ message: "Visa Expiry Date is required for non-Emirati users." });
        }
      }
    }

    // Get user ID from token
    const userId = req.user?.id; // You'll need to implement auth middleware to get this
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please login first." });
    }

    // First update the profile fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          // Only update fields that are provided
          ...(fullName && { fullName }),
          ...(email && { email }),
          ...(phoneNumber && { phoneNumber }),
          ...(location && { location }),
          ...(dateOfBirth && { dateOfBirth }),
          ...(nationality && { nationality }),
          ...(emirateId && { emirateId }),
          ...(passportNumber && { passportNumber }),
          ...(visaExpiryDate !== undefined && { visaExpiryDate: visaExpiryDate || null }),
          ...(introVideo && { introVideo }),
          ...(professionalSummary && { professionalSummary }),
          
          // Arrays and objects
          ...(professionalExperience && { professionalExperience }),
          ...(education && { education }),
          ...(skills && { skills }),
          ...(certifications && { certifications }),
          ...(jobPreferences && { jobPreferences }),
          ...(socialLinks && { socialLinks }),
          
          // Profile Picture
          ...(profilePicture && { profilePicture }),
          
          // Resume Document
          ...(resumeDocument && { resumeDocument }),
        }
      },
      { new: true } // Return updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate profile completion based on the updated user data
    // Match frontend calculation logic (24 total fields - employmentVisa removed)
    let completed = 0;
    const totalFields = 24;

    // Personal Info (9 fields) - matching frontend logic exactly
    if (updatedUser.fullName) completed++;
    if (updatedUser.email) completed++;
    if (updatedUser.phoneNumber) completed++;
    if (updatedUser.location) completed++;
    if (updatedUser.dateOfBirth) completed++;
    if (updatedUser.nationality) completed++;
    if (updatedUser.professionalSummary) completed++;
    if (updatedUser.emirateId) completed++;
    if (updatedUser.passportNumber) completed++;
    
    // Experience (4 fields)
    if (updatedUser.professionalExperience && updatedUser.professionalExperience.length > 0) {
      const exp = updatedUser.professionalExperience[0];
      if (exp?.currentRole) completed++;
      if (exp?.company) completed++;
      if (exp?.yearsOfExperience) completed++;
      if (exp?.industry) completed++;
    }

    // Education (4 fields)  
    if (updatedUser.education && updatedUser.education.length > 0) {
      const edu = updatedUser.education[0];
      if (edu?.highestDegree) completed++;
      if (edu?.institution) completed++;
      if (edu?.yearOfGraduation) completed++;
      if (edu?.gradeCgpa) completed++;
    }

    // Skills, Preferences, Certifications, Resume (4 fields)
    if (updatedUser.skills && updatedUser.skills.length > 0) completed++;
    if (updatedUser.jobPreferences?.preferredJobType && updatedUser.jobPreferences.preferredJobType.length > 0) completed++;
    if (updatedUser.certifications && updatedUser.certifications.length > 0) completed++;
    if (updatedUser.jobPreferences?.resumeAndDocs && updatedUser.jobPreferences.resumeAndDocs.length > 0) completed++;

    // Social Links (3 fields)
    if (updatedUser.socialLinks?.linkedIn) completed++;
    if (updatedUser.socialLinks?.instagram) completed++;
    if (updatedUser.socialLinks?.twitterX) completed++;

    // Helper function for tier determination (for display purposes only)
    const determineUserTier = (basePoints, yearsExp, isEmirati) => {
      if (isEmirati) return "Platinum";
      else if (basePoints >= 500) return "Platinum";
      else if (yearsExp >= 5) return "Gold";
      else if (yearsExp >= 2 && yearsExp <= 5) return "Silver";
      else return "Blue";
    };

    // Calculate percentage and base points
    const percentage = Math.round((completed / totalFields) * 100);
    const basePoints = 50 + (percentage * 2); // Base 50 + 2 points per percentage
    
    // Determine tier (for display purposes only, not used in calculation)
    const yearsExp = updatedUser?.professionalExperience?.[0]?.yearsOfExperience || 0;
    const isEmirati = updatedUser?.nationality?.toLowerCase()?.includes("emirati");
    const tier = determineUserTier(basePoints, yearsExp, isEmirati);
    
    // Use base points directly without multiplier
    const calculatedPoints = basePoints;
    
    // Add other points
    const applicationPoints = updatedUser?.rewards?.applyForJobs || 0;
    const rmServicePoints = updatedUser?.rewards?.rmService || 0;
    const socialMediaBonus = updatedUser?.rewards?.socialMediaBonus || 0;
    const referralPoints = updatedUser?.rewards?.referFriend || 0;
    const totalPoints = calculatedPoints + applicationPoints + rmServicePoints + socialMediaBonus + referralPoints;
    const calculatedProfileCompleted = percentage.toString();

    // Update the user with calculated points and profile completion
    // Preserve socialMediaBonus if it exists, otherwise initialize it
    const updateData = {
      'rewards.completeProfile': calculatedPoints,
      'rewards.totalPoints': totalPoints,
      'points': totalPoints,
      'profileCompleted': calculatedProfileCompleted
    };

    // Preserve socialMediaBonus if it exists
    if (updatedUser?.rewards?.socialMediaBonus !== undefined) {
      updateData['rewards.socialMediaBonus'] = updatedUser.rewards.socialMediaBonus;
    }

    const finalUpdatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: updateData
      },
      { new: true } // Return updated document
    );

    if (!finalUpdatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      data: finalUpdatedUser
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

// Check profile eligibility for job applications
exports.checkProfileEligibility = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized. Please login first." 
      });
    }

    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Calculate profile completion based on the same logic as updateProfile
    let completed = 0;
    const totalFields = 24;
    const missingFields = [];

    // Personal Info (9 fields) - matching frontend logic exactly
    if (user.fullName) completed++; else missingFields.push("Full Name");
    if (user.email) completed++; else missingFields.push("Email");
    if (user.phoneNumber) completed++; else missingFields.push("Phone Number");
    if (user.location) completed++; else missingFields.push("Location");
    if (user.dateOfBirth) completed++; else missingFields.push("Date of Birth");
    if (user.nationality) completed++; else missingFields.push("Nationality");
    if (user.professionalSummary) completed++; else missingFields.push("Professional Summary");
    if (user.emirateId) completed++; else missingFields.push("Emirates ID");
    if (user.passportNumber) completed++; else missingFields.push("Passport Number");

    // Experience (4 fields)
    const exp = user.professionalExperience?.[0];
    if (exp?.currentRole) completed++; else missingFields.push("Current Role");
    if (exp?.company) completed++; else missingFields.push("Company");
    if (exp?.yearsOfExperience) completed++; else missingFields.push("Years of Experience");
    if (exp?.industry) completed++; else missingFields.push("Industry");

    // Education (4 fields)
    const edu = user.education?.[0];
    if (edu?.highestDegree) completed++; else missingFields.push("Highest Degree");
    if (edu?.institution) completed++; else missingFields.push("Institution");
    if (edu?.yearOfGraduation) completed++; else missingFields.push("Year of Graduation");
    if (edu?.gradeCgpa) completed++; else missingFields.push("Grade/CGPA");

    // Skills, Preferences, Certifications (3 fields)
    if (user.skills && user.skills.length > 0) completed++; else missingFields.push("Skills");
    if (user.jobPreferences?.preferredJobType && user.jobPreferences.preferredJobType.length > 0) completed++; else missingFields.push("Job Preferences");
    if (user.certifications && user.certifications.length > 0) completed++; else missingFields.push("Certifications");

    // Resume check - comprehensive check for all possible resume locations
    const hasResume = !!(user.resumeDocument && user.resumeDocument.trim() !== '') ||
                     !!(user.resumeUrl && user.resumeUrl.trim() !== '') ||
                     !!(user.resume && (typeof user.resume === 'string' ? user.resume.trim() !== '' : user.resume)) ||
                     !!(user.jobPreferences?.resumeAndDocs && user.jobPreferences.resumeAndDocs.length > 0);
    
    if (hasResume) completed++; else missingFields.push("Resume (Required for job applications)");

    // Social Links (3 fields)
    if (user.socialLinks?.linkedIn) completed++; else missingFields.push("LinkedIn");
    if (user.socialLinks?.instagram) completed++; else missingFields.push("Instagram");
    if (user.socialLinks?.twitterX) completed++; else missingFields.push("Twitter/X");

    const percentage = Math.round((completed / totalFields) * 100);
    const canApply = percentage >= 80 && hasResume;

    res.status(200).json({
      success: true,
      data: {
        canApply: canApply,
        profileCompletion: {
          percentage: percentage,
          completed: completed,
          total: totalFields,
          missingFields: missingFields
        },
        resumeStatus: {
          hasResume: hasResume,
          resumeDocument: user.resumeDocument || null,
          resumeUrl: user.resumeUrl || null,
          resumeAndDocs: user.jobPreferences?.resumeAndDocs || []
        }
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Failed to check profile eligibility",
      error: error.message 
    });
  }
};

// Forgot Password - Generate reset token
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Find user in both collections
    let user = await User.findOne({ email });
    let userRole = 'jobseeker';
    
    if (!user) {
      user = await Employer.findOne({ email });
      userRole = 'employer';
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address"
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save reset token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // Send response first
    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email"
    });

    // Send email asynchronously (fire-and-forget)
    setImmediate(async () => {
      try {
        const { sendPasswordResetEmail } = require('../forgetPassword');
        const userName = userRole === 'jobseeker' 
          ? (user.fullName || user.name || 'User')
          : (user.name || user.companyName || 'User');
        
        const emailResult = await sendPasswordResetEmail(email, resetToken, userName);
        if (!emailResult.success) {
          console.error('Password reset email failed:', emailResult.error);
        }
      } catch (err) {
        console.error('Password reset email error:', err.message);
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process password reset request",
      error: error.message
    });
  }
};

// Validate Reset Token
exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required"
      });
    }

    // Find user with valid reset token
    let user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) {
      user = await Employer.findOne({
        resetPasswordToken: token,
        resetPasswordExpiry: { $gt: new Date() }
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    res.status(200).json({
      success: true,
      message: "Reset token is valid"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to validate reset token",
      error: error.message
    });
  }
};

// Follow Social Media - Award points for following LinkedIn/Instagram
exports.followSocialMedia = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { platform } = req.body; // 'linkedIn' or 'instagram'

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first."
      });
    }

    if (!platform || !['linkedIn', 'instagram'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: "Invalid platform. Must be 'linkedIn' or 'instagram'"
      });
    }

    // Find user based on role
    let user;
    if (userRole === 'employer') {
      user = await Employer.findById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user already followed this platform
    const fieldName = platform === 'linkedIn' ? 'linkedIn' : 'instagram';
    const alreadyFollowed = user[fieldName] === true;

    let pointsAwarded = 0;
    let message = "";

    if (!alreadyFollowed) {
      // Set the field to true
      user[fieldName] = true;
      
      // Award 10 points
      pointsAwarded = 10;
      
      // Initialize rewards if it doesn't exist
      if (!user.rewards) {
        user.rewards = {
          completeProfile: 0,
          applyForJobs: 0,
          referFriend: 0,
          totalPoints: 0,
          socialMediaBonus: 0
        };
      }

      // Add bonus points to existing socialMediaBonus
      const currentSocialBonus = user.rewards.socialMediaBonus || 0;
      user.rewards.socialMediaBonus = currentSocialBonus + pointsAwarded;
      
      // Get current total points from user.points (this includes all previous bonuses)
      const currentTotalPoints = user.points || 0;
      
      // Add the new bonus points to existing total
      const newTotalPoints = currentTotalPoints + pointsAwarded;
      
      // Update user points and rewards
      user.points = newTotalPoints;
      user.rewards.totalPoints = newTotalPoints;
      
      // Save to database
      await user.save();

      message = `Successfully followed us on ${platform === 'linkedIn' ? 'LinkedIn' : 'Instagram'}! You earned ${pointsAwarded} bonus points.`;
    } else {
      message = `You have already followed us on ${platform === 'linkedIn' ? 'LinkedIn' : 'Instagram'}.`;
    }

    // Get updated points
    let updatedUser;
    if (userRole === 'employer') {
      updatedUser = await Employer.findById(userId);
    } else {
      updatedUser = await User.findById(userId);
    }
    const totalPoints = updatedUser.points || 0;

    res.status(200).json({
      success: true,
      message,
      data: {
        platform,
        pointsAwarded,
        totalPoints,
        alreadyFollowed
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process follow action",
      error: error.message
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required"
      });
    }

    // Find user with valid reset token
    let user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    });

    let Model = User;
    if (!user) {
      user = await Employer.findOne({
        resetPasswordToken: token,
        resetPasswordExpiry: { $gt: new Date() }
      });
      if (user) {
        Model = Employer;
      }
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }
    
    // Update password and clear reset token using findByIdAndUpdate
    const updateResult = await Model.findByIdAndUpdate(
      user._id,
      {
        $set: {
          password: password
        },
        $unset: {
          resetPasswordToken: "",
          resetPasswordExpiry: ""
        }
      },
      { new: true, runValidators: true }
    );

    if (!updateResult) {
      return res.status(500).json({
        success: false,
        message: "Failed to update password"
      });
    }

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully"
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message
    });
  }
};

// Test Email Configuration Endpoint (for debugging in production)
exports.testEmailConfig = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Email functionality has been disabled",
      note: "Email sending has been removed from the application"
    });

  } catch (error) {
    console.error('[TestEmailConfig] Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to test email configuration",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Search user by email or phone (jobseeker only)
exports.searchUserByIdentifier = async (req, res) => {
  try {
    const rawIdentifier = req.query.identifier;

    if (!rawIdentifier || typeof rawIdentifier !== "string") {
      return res.status(400).json({
        success: false,
        message: "Search identifier (email or phone) is required",
      });
    }

    const identifier = rawIdentifier.trim();

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Search identifier cannot be empty",
      });
    }

    // Build query: restrict to jobseeker accounts only
    const baseFilter = { role: "jobseeker" };
    let query;

    if (identifier.includes("@")) {
      // Email lookup (case-insensitive)
      query = {
        ...baseFilter,
        email: identifier.toLowerCase(),
      };
    } else {
      // Phone lookup - use exact match to avoid false positives
      query = {
        ...baseFilter,
        phoneNumber: identifier,
      };
    }

    const user = await User.findOne(query).select("email fullName name role");

    if (!user) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "User does not exist in the portal",
      });
    }

    const displayName = user.fullName || user.name || user.email.split("@")[0];

    return res.status(200).json({
      success: true,
      exists: true,
      message: "User exists in the portal",
      data: {
        id: user._id,
        name: displayName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("searchUserByIdentifier error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to search user",
      error: error.message,
    });
  }
};

// Get users who joined using the current user's referral code (with basic details + pagination)
exports.getReferralJoiners = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    // This page is for jobseekers managing their referral program
    if (userRole !== "jobseeker") {
      return res.status(403).json({
        success: false,
        message: "Only jobseekers can view referral joiners.",
      });
    }

    // Parse pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limitRaw = parseInt(req.query.limit, 10) || 10;
    const limit = Math.min(Math.max(limitRaw, 1), 50); // cap to avoid abuse

    // Fetch all joiners (jobseekers + employers), then paginate in memory
    const [jobseekerJoiners, employerJoiners] = await Promise.all([
      User.find({ referredBy: userId })
        .select("fullName name email role createdAt phoneNumber location")
        .sort({ createdAt: -1 }),
      Employer.find({ referredBy: userId })
        .select("companyName name email role createdAt phoneNumber companyLocation")
        .sort({ createdAt: -1 }),
    ]);

    const joiners = [
      ...jobseekerJoiners.map((u) => ({
        id: u._id,
        name: u.fullName || u.name || (u.email ? u.email.split("@")[0] : "User"),
        email: u.email,
        role: u.role || "jobseeker",
        joinedAt: u.createdAt,
        phoneNumber: u.phoneNumber || "",
        location: u.location || "",
      })),
      ...employerJoiners.map((e) => ({
        id: e._id,
        name: e.companyName || e.name || (e.email ? e.email.split("@")[0] : "Employer"),
        email: e.email,
        role: "employer",
        joinedAt: e.createdAt,
        phoneNumber: e.phoneNumber || "",
        location: e.companyLocation || "",
      })),
    ];

    // Sort by most recent joiners first
    joiners.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    const total = joiners.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const startIndex = (page - 1) * limit;
    const paginatedJoiners = joiners.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      success: true,
      data: {
        total,
        page,
        limit,
        totalPages,
        joiners: paginatedJoiners,
      },
    });
  } catch (error) {
    console.error("getReferralJoiners error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral joiners",
      error: error.message,
    });
  }
};

// Get full profile of a single user who joined using the current user's referral code (or granted access)
exports.getReferralJoinerProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    if (userRole !== "jobseeker") {
      return res.status(403).json({
        success: false,
        message: "Only jobseekers can view referral joiner profiles.",
      });
    }

    // 1) Try to find a jobseeker referred by the current user
    let referredUser = await User.findOne({ _id: id, referredBy: userId }).select("-password");
    let type = "jobseeker";

    if (!referredUser) {
      // 2) Try employer referred by the current user
      referredUser = await Employer.findOne({ _id: id, referredBy: userId }).select("-password");
      type = "employer";
    }

    // 3) If not referred, check if access was granted via profile access request
    if (!referredUser) {
      const granted = await ProfileAccessRequest.findOne({
        requesterId: userId,
        targetUserId: id,
        status: "granted",
      });
      if (granted) {
        referredUser = await User.findById(id).select("-password");
        type = "jobseeker";
        if (!referredUser) {
          referredUser = await Employer.findById(id).select("-password");
          type = "employer";
        }
      }
    }

    if (!referredUser) {
      return res.status(404).json({
        success: false,
        message: "Referred user not found or not linked to your referral code.",
      });
    }

    let profile;
    if (type === "jobseeker" && typeof referredUser.getPublicProfile === "function") {
      profile = referredUser.getPublicProfile();
    } else if (type === "employer" && typeof referredUser.getPublicProfile === "function") {
      profile = referredUser.getPublicProfile();
    } else {
      profile = referredUser.toObject();
      delete profile.password;
    }

    return res.status(200).json({
      success: true,
      data: {
        type,
        profile,
      },
    });
  } catch (error) {
    console.error("getReferralJoinerProfile error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch referral joiner profile",
      error: error.message,
    });
  }
};

// Request access to view a user's profile (when they were not referred by you)
exports.requestProfileAccess = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const targetUserId = req.body?.targetUserId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    if (userRole !== "jobseeker") {
      return res.status(403).json({
        success: false,
        message: "Only jobseekers can request profile access.",
      });
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "targetUserId is required.",
      });
    }

    // Requester cannot request their own profile
    if (targetUserId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot request access to your own profile.",
      });
    }

    // Check if already has access (referred or granted)
    const referred = await User.findOne({ _id: targetUserId, referredBy: userId }) ||
      await Employer.findOne({ _id: targetUserId, referredBy: userId });
    if (referred) {
      return res.status(200).json({
        success: true,
        message: "You already have access to this profile.",
        alreadyGranted: true,
      });
    }

    const existingGrant = await ProfileAccessRequest.findOne({
      requesterId: userId,
      targetUserId,
      status: "granted",
    });
    if (existingGrant) {
      return res.status(200).json({
        success: true,
        message: "You already have access to this profile.",
        alreadyGranted: true,
      });
    }

    // Optional: one pending request per requester+target
    const pending = await ProfileAccessRequest.findOne({
      requesterId: userId,
      targetUserId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
    if (pending) {
      return res.status(200).json({
        success: true,
        message: "Access request already sent to the target user.",
        alreadyRequested: true,
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const targetUser = await User.findById(targetUserId).select("fullName name email");
    const targetEmployer = await targetUser ? null : await Employer.findById(targetUserId).select("companyName name email");
    const targetType = targetUser ? "jobseeker" : "employer";
    const targetName = targetUser
      ? (targetUser.fullName || targetUser.name || targetUser.email?.split("@")[0] || "User")
      : (targetEmployer?.companyName || targetEmployer?.name || targetEmployer?.email?.split("@")[0] || "User");

    if (!targetUser && !targetEmployer) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    await ProfileAccessRequest.create({
      requesterId: userId,
      targetUserId,
      targetType,
      token,
      expiresAt,
      status: "pending",
    });

    const requester = await User.findById(userId).select("email fullName name");
    if (!requester) {
      return res.status(400).json({
        success: false,
        message: "Requester not found.",
      });
    }

    const targetEmail = targetUser?.email || targetEmployer?.email;
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: "Target user email not found.",
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const accessLink = `${frontendUrl}/jobseeker/profile-access?token=${token}&userId=${targetUserId}`;

    const { sendProfileAccessEmail } = require("../profileAccessEmail");
    const requesterName = requester.fullName || requester.name || requester.email?.split("@")[0] || "A user";
    const emailResult = await sendProfileAccessEmail(targetEmail, accessLink, requesterName);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send access email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Request sent to target user. Access will be granted after they approve from email link.",
    });
  } catch (error) {
    console.error("requestProfileAccess error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request profile access",
      error: error.message,
    });
  }
};

// Confirm profile access (magic link) - no auth required
exports.confirmProfileAccess = async (req, res) => {
  try {
    const token = req.query?.token || req.body?.token;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required.",
      });
    }

    const request = await ProfileAccessRequest.findOne({
      token,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!request) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired link. Please request access again.",
      });
    }

    request.status = "granted";
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Access granted successfully.",
      userId: request.targetUserId.toString(),
    });
  } catch (error) {
    console.error("confirmProfileAccess error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to confirm access",
      error: error.message,
    });
  }
};

