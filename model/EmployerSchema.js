const mongoose = require("mongoose");

const employerSchema = new mongoose.Schema(
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
    role: {
      type: String,
      default: "employer",
      enum: ["employer"],
    },
    name: {
      type: String,
      trim: true,
      required: true,
    },
    profilePhoto: {
      type: String,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    companyEmail: {
      type: String,
      trim: true,
      default: "",
    },
    companyLogo: {
      type: String,
      default: "",
    },
    points: {
      type: Number,
      default: 0,
    },
    profileCompleted: {
      type: Number,
      default: 0,
    },
    phoneNumber:{
      type: String,
      default: "",
    },
    website:{
      type: String,
      default: "",
    },
    industry: {
      type: String,
      trim: true,
      default: "",
    },
    teamSize: {
      type: String,
      enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
      default: "1-10",
    },
    foundedYear: {
      type: Number,
      default: 0,
    },
    aboutCompany: {
      type: String,
      trim: true,
      default: "",
    },
    contactPerson: {
      name: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        default: "",
      },
      phone: {
        type: String,
        trim: true,
        default: "",
      },
    },
    companyLocation: {
      type: String,
      trim: true,
      default: "",
    },
    city:{
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    socialLinks: {
      linkedin: String,
      twitter: String,
      facebook: String,
    },
    activeJobs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job"
    }],
    applications: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application"
    }],
    postedJobs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job"
    }],
    subscriptionPlan: {
      type: String,
      enum: ["free", "basic", "premium", "enterprise"],
      default: "free"
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "inactive"
    },
    subscriptionExpiry: {
      type: Date
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    },
    documents: {
      businessLicense: String,
      taxRegistration: String,
      otherDocuments: [String]
    },
    hrServices: {
      type: [{
        serviceName: {
          type: String,
          enum: [
            "recruitment",
            "payroll",
            "training",
            "compliance",
            "performance",
            "analytics"
          ]
        },
        status: {
          type: String,
          enum: ["active", "inactive", "pending"],
          default: "inactive"
        },
        startDate: Date,
        endDate: Date
      }],
      default: []
    },
    membershipTier: { type: String, default: "Blue", enum: ["Blue", "Silver", "Gold", "Platinum"] },
    loginStatus: { 
      type: String, 
      default: "active", 
      enum: ["active", "blocked"] 
    },
    linkedIn: { type: Boolean, default: false },
    instagram: { type: Boolean, default: false },
    rewards: {
      completeProfile: { type: Number, default: 0 },
      applyForJobs: { type: Number, default: 0 },
      referFriend: { type: Number, default: 0 },
      totalPoints: { type: Number, default: 0 },
      socialMediaBonus: { type: Number, default: 0 }
    },
    notifications: {
      email: {
        applications: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        updates: { type: Boolean, default: true }
      },
      inApp: {
        applications: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        updates: { type: Boolean, default: true }
      }
    }
  },
  { timestamps: true }
);

employerSchema.pre('save', async function (next) {
  if (this.isNew && (!this.referralCode || this.referralCode === '')) {
    const employerName = this.name || this.companyName || this.email?.split('@')[0] || 'EMPLOYER';
    
    const namePart = employerName
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'X');
    
    const randomNum = Math.floor(Math.random() * 90) + 10;
    this.referralCode = `FINDR${namePart}${randomNum}`;
  }
  next();
});

// Method to compare password
employerSchema.methods.comparePassword = function (candidatePassword) {
  return this.password === candidatePassword;
};

// Method to get public profile
employerSchema.methods.getPublicProfile = function () {
  const employerObject = this.toObject();
  delete employerObject.password;
  return employerObject;
};

const Employer = mongoose.model("Employer", employerSchema);
module.exports = Employer;
