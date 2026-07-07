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
      type: Number,
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
    nationality: {
      type: String,
      trim: true, 
    },
    
    // Analytics
    views: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiredDate: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    }
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
jobSchema.post('init', function(doc) {
  if (doc.status === 'active' && doc.expiredDate && doc.expiredDate <= new Date()) {
    doc.status = 'expired';
  }
});

jobSchema.index({ title: 'text', description: 'text', companyName: 'text' });
jobSchema.index({ location: 1, jobType: 1, experienceLevel: 1 });
jobSchema.index({ status: 1, applicationDeadline: 1 });
jobSchema.index({ employer: 1 });
jobSchema.index({ employer: 1, status: 1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ employer: 1, createdAt: -1 });

const Job = mongoose.model("Job", jobSchema);
module.exports = Job;
