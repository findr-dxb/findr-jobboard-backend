const jwt = require("jsonwebtoken");
const User = require("../model/UserSchemas");
const Employer = require("../model/EmployerSchema");
require("dotenv").config();

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
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
    
    // Add user from payload
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = authMiddleware;
