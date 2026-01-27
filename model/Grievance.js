const mongoose = require('mongoose');

const grievanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FindrUser',
    required: false
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
}, {
  timestamps: true
});

grievanceSchema.index({ userId: 1 });
grievanceSchema.index({ createdAt: -1 });
grievanceSchema.index({ email: 1 });

module.exports = mongoose.model('Grievance', grievanceSchema);

