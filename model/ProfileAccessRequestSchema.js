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

profileAccessRequestSchema.index({ requesterId: 1, targetUserId: 1, status: 1 });
profileAccessRequestSchema.index({ token: 1 });
profileAccessRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL optional; we also check in code

const ProfileAccessRequest = mongoose.model("ProfileAccessRequest", profileAccessRequestSchema);
module.exports = ProfileAccessRequest;
