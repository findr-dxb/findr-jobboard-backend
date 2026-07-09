const mongoose = require("mongoose");

const employerRmPostingRequestSchema = new mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
    },
    employerName: {
      type: String,
      trim: true,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    employerEmail: {
      type: String,
      trim: true,
      default: "",
    },
    query: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["connect_clicked", "query_submitted", "posting_provided"],
      default: "connect_clicked",
    },
    clickedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    postingsGranted: {
      type: Number,
      default: null,
    },
    grantExpiresAt: {
      type: Date,
      default: null,
    },
    postingProvidedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

employerRmPostingRequestSchema.index({ employerId: 1, createdAt: -1 });
employerRmPostingRequestSchema.index({ status: 1, createdAt: -1 });
employerRmPostingRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  "EmployerRmPostingRequest",
  employerRmPostingRequestSchema
);
