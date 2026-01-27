 const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    // References
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true
    },
    
    // Job Basic Information
    title: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    jobType: {
      type: [String],
      enum: ["Full Time", "Part Time", "Contract", "Remote", "Hybrid"],
      required: true,
    },
    experienceLevel: {
      type: String,
      required: true,
    },
    salary: {
      type: {
        min: { type: Number, required: true },
        max: { type: Number, required: true },
      },
      required: true
    },

    // Job Details
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requirements: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    applicationDeadline: {
      type: Date,
      required: true,
    },

    // Job Status and Management
    status: {
      type: String,
      enum: ["draft", "active", "paused", "closed", "expired"],
      default: "active"
    },
    
    // Applications for this job
    applications: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application"
    }],
    
    // Analytics
    views: {
      type: Number,
      default: 0
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field for application count
jobSchema.virtual('applicationCount').get(function() {
  return this.applications?.length || 0;
});

// Index for better search performance
jobSchema.index({ title: 'text', description: 'text', company: 'text' });
jobSchema.index({ location: 1, jobType: 1, experienceLevel: 1 });
jobSchema.index({ status: 1, deadline: 1 });
jobSchema.index({ employer: 1 });

const Job = mongoose.model("Job", jobSchema);
module.exports = Job;
