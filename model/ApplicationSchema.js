const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    // References
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FindrUser",
      required: true
    },
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true
    },

    // Application Details
    status: {
      type: String,
      enum: ["pending", "shortlisted", "interview_scheduled", "hired", "rejected", "withdrawn"],
      default: "pending"
    },
    appliedDate: {
      type: Date,
      default: Date.now
    },
    
    // Documents
    resume: {
      type: String, // File URL/path
      required: true
    },
    coverLetter: {
      type: String, // File URL/path
      default: ""
    },
    additionalDocuments: [{
      fileName: String,
      fileUrl: String,
      uploadDate: { type: Date, default: Date.now }
    }],

    // Application-specific data
    expectedSalary: {
      min: Number,
      max: Number
    },
    availability: {
      type: String,
      default: ""
    },

    // Referral Information
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FindrUser",
      default: null
    },
    
    // Employer Actions
    employerNotes: {
      type: String,
      default: ""
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    interviewDate: {
      type: Date
    },
    interviewMode: {
      type: String,
      enum: ["in-person", "virtual"],
      default: "in-person"
    },
    feedback: {
      type: String,
      default: ""
    },

    // Tracking
    viewedByEmployer: {
      type: Boolean,
      default: false
    },
    viewedDate: {
      type: Date
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better performance
applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true }); // Prevent duplicate applications
applicationSchema.index({ employerId: 1, status: 1 });
applicationSchema.index({ appliedDate: -1 });

// Virtual to populate job details
applicationSchema.virtual('jobDetails', {
  ref: 'Job',
  localField: 'jobId',
  foreignField: '_id',
  justOne: true
});

// Virtual to populate applicant details
applicationSchema.virtual('applicantDetails', {
  ref: 'FindrUser',
  localField: 'applicantId',
  foreignField: '_id',
  justOne: true
});

const Application = mongoose.model("Application", applicationSchema);
module.exports = Application;
