const express = require("express");
const router = express.Router();
const { 
  addGrievance, 
  getGrievances, 
  getUserGrievances, 
  updateGrievance,
  getGrievance
} = require("../controller/Grievance");
const authMiddleware = require("../middleware/auth");
const optionalAuthMiddleware = require("../middleware/optionalAuth");

router.post("/contact", optionalAuthMiddleware, addGrievance);

router.get("/grievances/user", authMiddleware, getUserGrievances);

router.get("/grievances", authMiddleware, getGrievances);

router.get("/grievances/:id", authMiddleware, getGrievance);

router.put("/grievances/:id", authMiddleware, updateGrievance);

module.exports = router;

