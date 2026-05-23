const mongoose = require("mongoose");

const profileAccessRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FindrUser",
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetType: {
      type: String,
      enum: ["jobseeker", "employer"],
      default: "jobseeker",
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "granted"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// token: unique in schema
profileAccessRequestSchema.index({ requesterId: 1, targetUserId: 1, status: 1 });
profileAccessRequestSchema.index({ requesterId: 1, status: 1 });
profileAccessRequestSchema.index({ targetUserId: 1, status: 1 });
profileAccessRequestSchema.index({ requesterId: 1, targetUserId: 1 });
profileAccessRequestSchema.index({ createdAt: -1 });
profileAccessRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ProfileAccessRequest = mongoose.model("ProfileAccessRequest", profileAccessRequestSchema);
module.exports = ProfileAccessRequest;
