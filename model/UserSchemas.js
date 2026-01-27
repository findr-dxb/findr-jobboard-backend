const mongoose = require("mongoose");

const findrUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    resetPasswordToken: {
      type: String,
      default: undefined,
    },
    resetPasswordExpiry: {
      type: Date,
      default: undefined,
    },
    referralCode: {
      type: String,
      default: "",
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FindrUser",
      default: null,
    },
    visaExpiryDate: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["jobseeker", "employer"],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      required: true,
    },

    // Basic Profile
    profilePicture: {
      type: String,
      default: "",
    },
    fullName: {
      type: String,
      trim: true,
      default: "",
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    nationality: {
      type: String,
      trim: true,
      default: "",
    },
    emirateId: {
      type: String,
      trim: true,
      default: "",
    },
    passportNumber: {
      type: String,
      trim: true,
      default: "",
    },
    employmentVisa: {
      type: String,
      trim: true,
      default: "",
    },
    introVideo: {
      type: String, // URL
      trim: true,
      default: "",
    },
    resumeDocument: {
      type: String, // URL
      trim: true,
      default: "",
    },
    professionalSummary: {
      type: String,
      trim: true,
      default: "",
    },
    refersLink: {
      type: String,
      trim: true,
      default: "",
    },
    referredMember: {
      type: String,
      trim: true,
      default: "",
    },

    // Professional Experience
    professionalExperience: {
      type: [{
        currentRole: { type: String, trim: true, default: "" },
        company: { type: String, trim: true, default: "" },
        yearsOfExperience: { type: Number, min: 0, default: 0 },
        industry: { type: String, trim: true, default: "" },
      }],
      default: [],
    },

    // Education
    education: {
      type: [{
        highestDegree: { type: String, trim: true, default: "" },
        institution: { type: String, trim: true, default: "" },
        yearOfGraduation: { type: Number, default: null },
        gradeCgpa: { type: String, trim: true, default: "" },
      }],
      default: [],
    },

    // Skills & Certification
    skills: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },

    // Job Preferences
    jobPreferences: {
      preferredJobType: {
        type: [String],
        enum: ["Full Time", "Part Time", "Contract", "Remote", "Hybrid", "full-time", "part-time", "contract", "remote", "hybrid"],
        default: [],
      },
      salaryExpectation: { type: String, trim: true, default: "" },
      preferredLocation: { type: String, trim: true, default: "" },
      availability: { type: String, trim: true, default: "" },
      resumeAndDocs: {
        type: [String], // store file URLs
        maxItems: 4, // CV + up to 3 docs
        default: [],
      },
    },

    // Social Media Links
    socialLinks: {
      linkedIn: { type: String, trim: true, default: "" },
      instagram: { type: String, trim: true, default: "" },
      twitterX: { type: String, trim: true, default: "" },
    },

    // RM Service
    rmService: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Inactive",
    },
    // Rewards
    rewards: {
      completeProfile: { type: Number, default: 0 },
      applyForJobs: { type: Number, default: 0 },
      referFriend: { type: Number, default: 0 },
      totalPoints: { type: Number, default: 0 },
      socialMediaBonus: { type: Number, default: 0 }, // Bonus points from following LinkedIn/Instagram
    },
    referralRewardPoints: {
      type: Number,
      default: 0,
    },

    // Applications
    applications: {
      totalApplications: { type: Number, default: 0 },
      activeApplications: { type: Number, default: 0 },
      awaitingFeedback: { type: Number, default: 0 },
      appliedJobs: [
        {
          jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
          role: String,
          company: String,
          date: { type: Date, default: Date.now },
        },
      ],
    },

    // Saved Jobs
    savedJobs: [
      {
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
        role: String,
        company: String,
        dateSaved: { type: Date, default: Date.now },
      },
    ],

    // Orders
    orders: [
      {
        service: { type: String, required: true },
        price: { type: Number, required: true },
        pointsUsed: { type: Number, default: 0 },
        couponCode: { type: String, default: "" },
        totalAmount: { type: Number, required: true },
        orderDate: { type: Date, default: Date.now },
        status: { type: String, default: "completed" }
      }
    ],

    profileCompleted: { type: String, default: "0" },
    linkedIn: { type: Boolean, default: false },
    instagram: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    deductedPoints: { type: Number, default: 0 }, // Track points deducted from orders
    membershipTier: { type: String, default: "Blue", enum: ["Blue", "Silver", "Gold", "Platinum"] },
    loginStatus: {
      type: String,
      default: "active",
      enum: ["active", "blocked"]
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate referral code for new users
findrUserSchema.pre('save', async function (next) {
  // Only generate referral code if this is a new user and referralCode is empty
  if (this.isNew && (!this.referralCode || this.referralCode === '')) {
    // Get user's name (prefer name, then fullName, then email username)
    const userName = this.name || this.fullName || this.email?.split('@')[0] || 'USER';
    
    // Extract first 3 letters of name (uppercase), pad if needed
    const namePart = userName
      .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'X'); // Pad with 'X' if name is too short
    
    // Generate random 2-digit number (10-99)
    const randomNum = Math.floor(Math.random() * 90) + 10;
    
    // Create referral code: FINDR + namePart + randomNum
    this.referralCode = `FINDR${namePart}${randomNum}`;
  }
  next();
});

// Method to compare password
findrUserSchema.methods.comparePassword = function (candidatePassword) {
  return this.password === candidatePassword;
};

// Method to get public profile
findrUserSchema.methods.getPublicProfile = function () {
  const userObject = this.toObject();
  delete userObject.password;

  // Ensure name is always present
  if (!userObject.name && userObject.fullName) {
    userObject.name = userObject.fullName;
  } else if (!userObject.name && !userObject.fullName) {
    userObject.name = userObject.email.split('@')[0];
  }

  return userObject;
};

const FindrUser = mongoose.model("FindrUser", findrUserSchema);
module.exports = FindrUser;
