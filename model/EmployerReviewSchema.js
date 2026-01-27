const mongoose = require("mongoose");

const employerReviewSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comments: {
      type: String,
      maxLength: 1000,
      default: ""
    },
    status: {
      type: String,
      enum: ["pending", "shortlisted", "rejected", "interview_scheduled", "hired"],
      default: "pending"
    },
    interviewNotes: {
      type: String,
      maxLength: 1000,
      default: ""
    },
    interviewDate: {
      type: Date
    },
    interviewMode: {
      type: String,
      enum: ["in-person", "virtual"]
    }
  },
  { timestamps: true }
);

// Ensure one review per employer-application combination
employerReviewSchema.index({ employerId: 1, applicationId: 1 }, { unique: true });

const EmployerReview = mongoose.model("EmployerReview", employerReviewSchema);
module.exports = EmployerReview;
