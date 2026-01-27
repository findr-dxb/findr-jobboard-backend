const express = require("express");
const router = express.Router();
const { 
  createQuoteRequest, 
  getQuoteRequests, 
  getEmployerQuoteRequests, 
  updateQuoteRequest, 
  getQuoteRequest 
} = require("../controller/QuoteController");
const authMiddleware = require("../middleware/auth");

// Create quote request (employer)
router.post("/quotes", authMiddleware, createQuoteRequest);

// Get quote requests for employer
router.get("/quotes/employer", authMiddleware, getEmployerQuoteRequests);

// Get all quote requests (admin)
router.get("/quotes", authMiddleware, getQuoteRequests);

// Get single quote request
router.get("/quotes/:id", authMiddleware, getQuoteRequest);

// Update quote request (admin)
router.put("/quotes/:id", authMiddleware, updateQuoteRequest);

module.exports = router;

