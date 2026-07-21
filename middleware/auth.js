const jwt = require("jsonwebtoken");
const User = require("../model/UserSchemas");
const Employer = require("../model/EmployerSchema");
require("dotenv").config();

const ACTIVITY_TOUCH_MS = 5 * 60 * 1000; // refresh lastLoginAt at most every 5 minutes

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Skip activity tracking for admin tokens
    if (decoded.type === "admin" || decoded.role === "admin" || decoded.role === "superadmin") {
      req.user = decoded;
      return next();
    }
    
    // Check if user is blocked
    let user;
    if (decoded.role === 'employer') {
      user = await Employer.findById(decoded.id);
    } else {
      user = await User.findById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.loginStatus === 'blocked') {
      return res.status(403).json({ 
        message: "Your account has been blocked. Please contact support.",
        blocked: true 
      });
    }

    // Keep "Active Users Today" in sync while the user is online
    const lastLoginAt = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
    if (!lastLoginAt || Date.now() - lastLoginAt >= ACTIVITY_TOUCH_MS) {
      const Model = decoded.role === "employer" ? Employer : User;
      Model.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch((err) => {
        console.error("Failed to update lastLoginAt:", err.message);
      });
      user.lastLoginAt = new Date();
    }

    req.userDoc = user;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = authMiddleware;
