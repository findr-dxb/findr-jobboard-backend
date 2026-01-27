const express = require("express");
const app = express();
const cors = require("cors");
const Stripe = require('stripe');

require("dotenv").config();
const PORT = process.env.PORT || 4000;


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


app.use(cors({
  origin: "*",
  credentials: false
}));

app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📥 [${timestamp}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    // Log request body (hide sensitive data)
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '***HIDDEN***';
    if (sanitizedBody.token) sanitizedBody.token = sanitizedBody.token.substring(0, 10) + '...';
    console.log(`📥 Body:`, JSON.stringify(sanitizedBody, null, 2));
  }
  next();
});

require("./config/database").connect();

const user = require("./route/User");
const upload = require("./route/upload");
const job = require("./route/job");
const employer = require("./route/employer");
const application = require("./route/application");
const admin = require("./route/admin");
const quote = require("./route/quote");
const order = require("./route/order");
const grievance = require("./route/grievance");

app.use("/api/v1", user);
app.use("/api/v1", upload);
app.use("/api/v1", job);
app.use("/api/v1", employer);
app.use("/api/v1", application);
app.use("/api/v1", admin);
app.use("/api/v1", quote);
app.use("/api/v1", order);
app.use("/api/v1", grievance);

// Middleware to verify JWT token
const authMiddleware = require("./middleware/auth");

// Create Stripe checkout session for RM Service
app.post('/api/v1/rm-service/checkout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pointsUsed = 0, totalAmount } = req.body;

    // Get user to verify and get email
    const User = require("./model/UserSchemas");
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Calculate amount in cents (AED * 100)
    const amountInCents = Math.round((totalAmount || 2500) * 100);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'aed',
            product_data: {
              name: 'Virtual RM Service',
              description: 'Dedicated Relationship Manager for your job search journey',
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
        service: 'Virtual RM Service',
        pointsUsed: pointsUsed.toString(),
        totalAmount: (totalAmount || 2500).toString(),
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobseeker/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobseeker/cart`,
    });

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


app.post('/api/v1/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      const bodyString = Buffer.isBuffer(req.body) ? req.body.toString() : req.body;
      event = typeof bodyString === 'string' ? JSON.parse(bodyString) : bodyString;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const User = require("./model/UserSchemas");
      const userId = session.metadata?.userId;

      if (!userId) {
        console.error('No userId in session metadata');
        return res.status(400).json({ error: 'Missing userId in metadata' });
      }

      const user = await User.findById(userId);
      if (!user) {
        console.error('User not found:', userId);
        return res.status(404).json({ error: 'User not found' });
      }

      // Extract metadata
      const pointsUsed = parseInt(session.metadata?.pointsUsed || '0');
      const totalAmount = parseFloat(session.metadata?.totalAmount || '2500');

      // Calculate points (same logic as OrderController)
      const calculateProfilePoints = (profile) => {
        let completed = 0;
        const totalFields = 24;

        if (profile?.fullName) completed++;
        if (profile?.email) completed++;
        if (profile?.phoneNumber) completed++;
        if (profile?.location) completed++;
        if (profile?.dateOfBirth) completed++;
        if (profile?.nationality) completed++;
        if (profile?.professionalSummary) completed++;
        if (profile?.emirateId) completed++;
        if (profile?.passportNumber) completed++;

        const exp = profile?.professionalExperience?.[0];
        if (exp?.currentRole) completed++;
        if (exp?.company) completed++;
        if (exp?.yearsOfExperience) completed++;
        if (exp?.industry) completed++;

        const edu = profile?.education?.[0];
        if (edu?.highestDegree) completed++;
        if (edu?.institution) completed++;
        if (edu?.yearOfGraduation) completed++;
        if (edu?.gradeCgpa) completed++;

        if (profile?.skills && profile.skills.length > 0) completed++;
        if (profile?.jobPreferences?.preferredJobType && profile.jobPreferences.preferredJobType.length > 0) completed++;
        if (profile?.certifications && profile.certifications.length > 0) completed++;
        if (profile?.jobPreferences?.resumeAndDocs && profile.jobPreferences.resumeAndDocs.length > 0) completed++;
        if (profile?.socialLinks?.linkedIn) completed++;
        if (profile?.socialLinks?.instagram) completed++;
        if (profile?.socialLinks?.twitterX) completed++;

        const percentage = Math.round((completed / totalFields) * 100);
        const calculatedPoints = 50 + percentage * 2;
        const applicationPoints = profile?.rewards?.applyForJobs || 0;
        const currentRmServicePoints = profile?.rewards?.rmService || 0;

        return calculatedPoints + applicationPoints + currentRmServicePoints;
      };

      const currentTotalPoints = calculateProfilePoints(user);
      const currentDeductedPoints = user.deductedPoints || 0;
      const newDeductedPoints = currentDeductedPoints + pointsUsed;

      // Create order object
      const order = {
        service: 'Virtual RM Service',
        price: totalAmount,
        pointsUsed: pointsUsed,
        couponCode: '',
        totalAmount: totalAmount,
        orderDate: new Date(),
        status: 'completed',
        paymentMethod: 'stripe',
        stripeSessionId: session.id
      };

      // Update user: activate RM service, add order, update points
      await User.findByIdAndUpdate(userId, {
        $set: {
          "deductedPoints": newDeductedPoints,
          "rmService": "Active"
        },
        $inc: {
          "rewards.rmService": 100,
          "rewards.totalPoints": 100
        },
        $push: {
          orders: order
        }
      });

      console.log('[StripeWebhook] RM Service activated for user:', userId);
      res.json({ received: true });
    } catch (error) {
      console.error('[StripeWebhook] Error processing payment:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.json({ received: true });
  }
});

// Legacy endpoint (keep for backward compatibility)
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: req.body.items || [
        { price_data: {
            currency: 'aed',
            product_data: { name: 'Findr Premium Service' },
            unit_amount: 2500
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancel`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`App is Listening at ${PORT}`);
});