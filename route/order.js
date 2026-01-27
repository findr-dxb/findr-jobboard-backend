const express = require("express");
const router = express.Router();
const { createOrder, getUserOrders } = require("../controller/OrderController");
const authMiddleware = require("../middleware/auth");

// Create order
router.post("/orders", authMiddleware, createOrder);

// Get user orders
router.get("/orders", authMiddleware, getUserOrders);

module.exports = router;
