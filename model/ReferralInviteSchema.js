const mongoose = require("mongoose");

const referralInviteSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FindrUser",
      required: true,
    },
    referrerName: { type: String, default: "" },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    jobTitle: { type: String, default: "" },
    companyName: { type: String, default: "" },
    // Data about the referred person
    friendName: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    nationality: { type: String, default: "" },
    currentCompany: { type: String, default: "" },
    expectedSalary: { type: String, default: "0" },
    location: { type: String, default: "" },
    education: { type: String, default: "" },
    skills: { type: String, default: "" },
    certifications: { type: String, default: "" },
    resumeUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  },
  { timestamps: true },
);

referralInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ReferralInvite = mongoose.model("ReferralInvite", referralInviteSchema);
module.exports = ReferralInvite;
