const User = require("../model/UserSchemas");

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const { service, price, pointsUsed, couponCode, totalAmount } = req.body;
    const userId = req.user.id;

    // Get user data to check points balance
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate user's actual points based on profile completion (same as frontend)
    const calculateProfilePoints = (profile) => {
      let completed = 0;
      const totalFields = 24;

      // Personal Info (9 fields - employmentVisa removed)
      if (profile?.fullName) completed++;
      if (profile?.email) completed++;
      if (profile?.phoneNumber) completed++;
      if (profile?.location) completed++;
      if (profile?.dateOfBirth) completed++;
      if (profile?.nationality) completed++;
      if (profile?.professionalSummary) completed++;
      if (profile?.emirateId) completed++;
      if (profile?.passportNumber) completed++;

      // Experience (4 fields)
      const exp = profile?.professionalExperience?.[0];
      if (exp?.currentRole) completed++;
      if (exp?.company) completed++;
      if (exp?.yearsOfExperience) completed++;
      if (exp?.industry) completed++;

      // Education (4 fields)
      const edu = profile?.education?.[0];
      if (edu?.highestDegree) completed++;
      if (edu?.institution) completed++;
      if (edu?.yearOfGraduation) completed++;
      if (edu?.gradeCgpa) completed++;

      // Skills, Preferences, Certifications, Resume (4 fields)
      if (profile?.skills && profile.skills.length > 0) completed++;
      if (profile?.jobPreferences?.preferredJobType && profile.jobPreferences.preferredJobType.length > 0) completed++;
      if (profile?.certifications && profile.certifications.length > 0) completed++;
      if (profile?.jobPreferences?.resumeAndDocs && profile.jobPreferences.resumeAndDocs.length > 0) completed++;

      // Social Links (3 fields)
      if (profile?.socialLinks?.linkedIn) completed++;
      if (profile?.socialLinks?.instagram) completed++;
      if (profile?.socialLinks?.twitterX) completed++;

      const percentage = Math.round((completed / totalFields) * 100);
      const calculatedPoints = 50 + percentage * 2; // Base 50 + 2 points per percentage (100% = 250 points)
      const applicationPoints = profile?.rewards?.applyForJobs || 0; // Points from job applications
      const rmServicePoints = profile?.rewards?.rmService || 0; // Points from RM service purchase
      const totalPoints = calculatedPoints + applicationPoints + rmServicePoints;

      return totalPoints;
    };

    // Calculate current points components
    let completed = 0;
    const totalFields = 24;
    if (user?.fullName) completed++;
    if (user?.email) completed++;
    if (user?.phoneNumber) completed++;
    if (user?.location) completed++;
    if (user?.dateOfBirth) completed++;
    if (user?.nationality) completed++;
    if (user?.professionalSummary) completed++;
    if (user?.emirateId) completed++;
    if (user?.passportNumber) completed++;
    const exp = user?.professionalExperience?.[0];
    if (exp?.currentRole) completed++;
    if (exp?.company) completed++;
    if (exp?.yearsOfExperience) completed++;
    if (exp?.industry) completed++;
    const edu = user?.education?.[0];
    if (edu?.highestDegree) completed++;
    if (edu?.institution) completed++;
    if (edu?.yearOfGraduation) completed++;
    if (edu?.gradeCgpa) completed++;
    if (user?.skills && user.skills.length > 0) completed++;
    if (user?.jobPreferences?.preferredJobType && user.jobPreferences.preferredJobType.length > 0) completed++;
    if (user?.certifications && user.certifications.length > 0) completed++;
    if (user?.jobPreferences?.resumeAndDocs && user.jobPreferences.resumeAndDocs.length > 0) completed++;
    if (user?.socialLinks?.linkedIn) completed++;
    if (user?.socialLinks?.instagram) completed++;
    if (user?.socialLinks?.twitterX) completed++;

    // Helper functions for tier multiplier calculation
    const getExperienceLevel = (yearsExp) => {
      if (yearsExp <= 1) return 'Blue';
      else if (yearsExp >= 2 && yearsExp <= 5) return 'Silver';
      else return 'Gold';
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

    const percentage = Math.round((completed / totalFields) * 100);
    const basePoints = 50 + percentage * 2;
    
    // Determine tier and experience level (exp already declared above)
    const yearsExp = exp?.yearsOfExperience || 0;
    const isEmirati = user?.nationality?.toLowerCase()?.includes("emirati");
    const experienceLevel = getExperienceLevel(yearsExp);
    const tier = determineUserTier(basePoints, yearsExp, isEmirati);
    
    // Get tier multiplier and apply to base points
    const multiplier = getTierMultiplier(tier, experienceLevel);
    const calculatedPoints = basePoints * multiplier;
    
    const applicationPoints = user.rewards?.applyForJobs || 0;
    const currentRmServicePoints = user.rewards?.rmService || 0;
    const socialMediaBonus = user.rewards?.socialMediaBonus || 0;
    const referralRewardPoints = user.referralRewardPoints || 0;
    
    const activityPoints = calculatedPoints + applicationPoints + currentRmServicePoints + socialMediaBonus;
    const currentTotalPoints = activityPoints + referralRewardPoints;
    const currentDeductedPoints = user.deductedPoints || 0;
    const currentAvailablePoints = Math.max(0, currentTotalPoints - currentDeductedPoints);
    
    if (pointsUsed > 0 && pointsUsed > currentAvailablePoints) {
      return res.status(400).json({ 
        message: "Insufficient points", 
        availablePoints: currentAvailablePoints 
      });
    }

    // Create order object
    const order = {
      service,
      price,
      pointsUsed,
      couponCode,
      totalAmount,
      orderDate: new Date(),
      status: "completed"
    };

    // Calculate new values after purchase
    const newDeductedPoints = currentDeductedPoints + pointsUsed;
    const newRmServicePoints = currentRmServicePoints + 100; // Award 100 points for RM service purchase
    // Recalculate total points including all components (base points already multiplied)
    const newActivityPoints = calculatedPoints + applicationPoints + newRmServicePoints + socialMediaBonus;
    const newTotalPoints = newActivityPoints + referralRewardPoints;
    const availablePoints = Math.max(0, newTotalPoints - newDeductedPoints);
    
    const updateResult = await User.findByIdAndUpdate(userId, {
      $set: {
        "deductedPoints": newDeductedPoints,
        "rmService": "Active" // Activate RM Service
      },
      $inc: {
        "rewards.rmService": 100, // Award 100 points for purchasing RM service
        "rewards.totalPoints": 100, // Add to total points
        "points": 100 // Update total points field
      },
      $push: {
        orders: order
      }
    }, { new: true });
    

    // Send HTTP response FIRST
    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order,
        remainingPoints: availablePoints, // Correct available points after purchase
        pointsAwarded: 100
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to place order", 
      error: error.message 
    });
  }
};

// Get user orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('orders rmService');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      data: {
        orders: user.orders || [],
        rmService: user.rmService || "inactive"
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch orders", 
      error: error.message 
    });
  }
};

