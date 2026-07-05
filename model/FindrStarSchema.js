const mongoose = require('mongoose');

const findrStarSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['jobseeker', 'employer'],
    required: true
  },
  profilePicture: {
    type: String,
    default: ""
  },
  points: {
    type: Number,
    default: 0
  },
  appreciationMessage: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    default: null
  }
}, {
  timestamps: true
});

findrStarSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('FindrStar', findrStarSchema);
