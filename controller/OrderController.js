const User = require("../model/UserSchemas");
const { calculateJobseekerProfileCompletion } = require("../utils/jobseekerProfileCompletion");

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

    const completion = calculateJobseekerProfileCompletion(user);
    const calculatedPoints = completion.profilePoints;
    
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
    // Recalculate total points including all components
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

    // Log reward transaction in DB
    try {
      const Reward = require("../model/RewardSchema");
      const rewardTx = new Reward({
        userId: userId,
        userModel: "FindrUser",
        rewardType: "activity",
        points: 100,
        rewardHistory: [{
          description: `Purchased Service: ${service}`,
          date: new Date(),
          points: 100
        }]
      });
      await rewardTx.save();

      if (pointsUsed > 0) {
        const deductTx = new Reward({
          userId: userId,
          userModel: "FindrUser",
          rewardType: "withdraw",
          points: -pointsUsed,
          rewardHistory: [{
            description: `Redeemed points for Service: ${service}`,
            date: new Date(),
            points: -pointsUsed
          }]
        });
        await deductTx.save();
      }
    } catch (logErr) {
      console.error("Failed to log order reward transaction:", logErr);
    }

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

