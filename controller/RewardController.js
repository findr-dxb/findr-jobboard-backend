const mongoose = require("mongoose");
const Reward = require("../model/RewardSchema");

// Get all point transactions for the logged-in user/employer
exports.getRewardHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please login first." });
    }

    // Determine userModel based on role
    const userModel = role === "employer" ? "Employer" : "FindrUser";

    // Query all transactions for this user/employer, sorted by newest first
    let transactions = await Reward.find({ userId, userModel })
      .sort({ createdAt: -1 })
      .lean();

    // If no transactions exist in the DB, auto-seed based on current profile metrics
    if (transactions.length === 0) {
      try {
        const User = require("../model/UserSchemas");
        const Employer = require("../model/EmployerSchema");
        const Job = require("../model/JobSchema");
        const seedTransactions = [];

        if (userModel === "Employer") {
          const employer = await Employer.findById(userId).populate("postedJobs");
          if (employer) {
            const jobs = employer.postedJobs || [];
            for (const job of jobs) {
              seedTransactions.push({
                userId,
                userModel,
                rewardType: "activity",
                points: 100,
                rewardHistory: [{
                  description: `Posted a job: ${job.title}`,
                  date: job.createdAt || new Date(),
                  points: 100
                }],
                date: job.createdAt || new Date(),
              });
            }
            if (employer.profileCompleted > 0) {
              const pointsForProfile = employer.profileCompleted;
              seedTransactions.push({
                userId,
                userModel,
                rewardType: "activity",
                points: pointsForProfile,
                rewardHistory: [{
                  description: "Completed Company Profile",
                  date: employer.createdAt || new Date(),
                  points: pointsForProfile
                }],
                date: employer.createdAt || new Date(),
              });
            }
          }
        } else {
          const user = await User.findById(userId);
          if (user) {
            const completeProfilePoints = user.rewards?.completeProfile || 0;
            if (completeProfilePoints > 0) {
              seedTransactions.push({
                userId,
                userModel,
                rewardType: "activity",
                points: completeProfilePoints,
                rewardHistory: [{
                  description: "Completed User Profile",
                  date: user.createdAt || new Date(),
                  points: completeProfilePoints
                }],
                date: user.createdAt || new Date(),
              });
            }
            const applyForJobsPoints = user.rewards?.applyForJobs || 0;
            if (applyForJobsPoints > 0) {
              seedTransactions.push({
                userId,
                userModel,
                rewardType: "activity",
                points: applyForJobsPoints,
                rewardHistory: [{
                  description: "Applied for Jobs",
                  date: new Date(),
                  points: applyForJobsPoints
                }],
                date: new Date(),
              });
            }
            const referralPoints = user.rewards?.referFriend || 0;
            if (referralPoints > 0) {
              seedTransactions.push({
                userId,
                userModel,
                rewardType: "referral",
                points: referralPoints,
                rewardHistory: [{
                  description: "Referral Signups",
                  date: new Date(),
                  points: referralPoints
                }],
                date: new Date(),
              });
            }
            const placementPoints = user.referralRewardPoints || 0;
            if (placementPoints > 0) {
              seedTransactions.push({
                userId,
                userModel,
                rewardType: "placement",
                points: placementPoints,
                rewardHistory: [{
                  description: "Job Placements Referral Reward",
                  date: new Date(),
                  points: placementPoints
                }],
                date: new Date(),
              });
            }
            const deductedPoints = user.deductedPoints || 0;
            if (deductedPoints > 0) {
              seedTransactions.push({
                userId,
                userModel,
                rewardType: "withdraw",
                points: -deductedPoints,
                rewardHistory: [{
                  description: "Redeemed points for services",
                  date: new Date(),
                  points: -deductedPoints
                }],
                date: new Date(),
              });
            }
          }
        }

        if (seedTransactions.length > 0) {
          await Reward.insertMany(seedTransactions);
          transactions = await Reward.find({ userId, userModel })
            .sort({ createdAt: -1 })
            .lean();
        }
      } catch (seedError) {
        console.error("Failed to seed historical reward transactions:", seedError);
      }
    }

    const typeMapping = {
      placement: {
        label: "Placement Reward",
        emoji: "🏆",
        colorClass: "text-amber-600 bg-amber-50 border-amber-200"
      },
      activity: {
        label: "Activity Points",
        emoji: "📝",
        colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200"
      },
      referral: {
        label: "Referral Bonus",
        emoji: "🤝",
        colorClass: "text-blue-600 bg-blue-50 border-blue-200"
      },
      withdraw: {
        label: "Redeemed Points",
        emoji: "💸",
        colorClass: "text-rose-600 bg-rose-50 border-rose-200"
      },
      referral_fee: {
        label: "Referral Fee",
        emoji: "💼",
        colorClass: "text-purple-600 bg-purple-50 border-purple-200"
      }
    };

    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      displayInfo: typeMapping[tx.rewardType] || {
        label: "Point Update",
        emoji: "✨",
        colorClass: "text-gray-600 bg-gray-50 border-gray-200"
      }
    }));

    return res.status(200).json({
      success: true,
      count: formattedTransactions.length,
      data: formattedTransactions,
    });
  } catch (error) {
    console.error("Error fetching reward history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch reward history",
      error: error.message,
    });
  }
};

exports.createRewardTransaction = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { rewardType, points, rewardHistory = [], description } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please login first." });
    }

    if (!rewardType || points === undefined) {
      return res.status(400).json({
        success: false,
        message: "rewardType and points are required fields.",
      });
    }

    const userModel = role === "employer" ? "Employer" : "FindrUser";

    const historyEntry = {
      description: description || `Points earned/spent via ${rewardType}`,
      date: new Date(),
      points,
      ...rewardHistory,
    };

    const newTransaction = new Reward({
      userId,
      userModel,
      rewardType,
      points,
      rewardHistory: [historyEntry],
    });

    await newTransaction.save();

    return res.status(201).json({
      success: true,
      message: "Point transaction logged successfully",
      data: newTransaction,
    });
  } catch (error) {
    console.error("Error logging reward transaction:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to log reward transaction",
      error: error.message,
    });
  }
};
