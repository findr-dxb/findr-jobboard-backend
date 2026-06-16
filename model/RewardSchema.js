const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "userModel",
      required: true,
    },
    userModel: {
      type: String,
      required: true,
      enum: ["FindrUser", "Employer"],
    },
    rewardType: {
      type: String,
      required: true,
      enum: ["placement", "activity", "referral","withdraw", "referral_fee"],
    },
    points: {
      type: Number,
      required: true,
    },
    rewardHistory: {
      type: Array,
      default: [],
    },
    date:{
      type: Date,
      default: Date.now,
    }
  },
  { timestamps: true },
);

module.exports = mongoose.model("Reward", rewardSchema);