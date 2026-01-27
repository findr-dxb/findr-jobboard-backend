const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe checkout session for RM Service (handles both AED-only and hybrid payments)
router.post('/rm-service/checkout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      pointsUsed = 0, 
      totalAmount, 
      service, 
      services, 
      paymentMethod = 'aed',
      hybridPayment 
    } = req.body;

    // Get user to verify and get email
    const User = require("../model/UserSchemas");
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Determine service name and description
    let serviceName = service || 'Virtual RM Service';
    let serviceDescription = 'Dedicated Relationship Manager for your job search journey';
    let aedAmount = totalAmount || 2500;
    let totalPointsToUse = pointsUsed;

    // Handle multiple services (cart scenario)
    if (services && Array.isArray(services)) {
      const serviceNames = services.map(s => s.service).join(', ');
      serviceName = `RM Services: ${serviceNames}`;
      serviceDescription = `Multiple RM services package`;
      
      // Calculate totals from services array
      totalPointsToUse = services.reduce((sum, s) => sum + (s.pointsToUse || 0), 0);
      aedAmount = services.reduce((sum, s) => sum + (s.aedAmount || 0), 0);
    }

    // Handle hybrid payment description
    if (paymentMethod === 'hybrid' || hybridPayment) {
      serviceDescription = `Hybrid Payment: ${totalPointsToUse} Points + AED ${aedAmount}`;
    }

    // Calculate amount in cents (AED * 100)
    const amountInCents = Math.round(aedAmount * 100);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aed',
            product_data: {
              name: serviceName,
              description: serviceDescription,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      customer_email: user.email,
      metadata: {
        userId: userId.toString(),
        service: serviceName,
        pointsUsed: totalPointsToUse.toString(),
        aedAmount: aedAmount.toString(),
        totalAmount: aedAmount.toString(),
        paymentMethod: paymentMethod,
        services: services ? JSON.stringify(services) : JSON.stringify([{ service: serviceName }])
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobseeker/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobseeker/cart`,
    });

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      ...(hybridPayment && { hybridPayment })
    });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


module.exports = router;