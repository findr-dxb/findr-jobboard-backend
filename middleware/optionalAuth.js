const jwt = require("jsonwebtoken");
const User = require("../model/UserSchemas");
const Employer = require("../model/EmployerSchema");
require("dotenv").config();

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user;
    if (decoded.role === 'employer') {
      user = await Employer.findById(decoded.id);
    } else {
      user = await User.findById(decoded.id);
    }

    if (user && user.loginStatus !== 'blocked') {
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = optionalAuthMiddleware;

