const mongoose = require('mongoose');

const quoteRequestSchema = new mongoose.Schema({
  employerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employer',
    required: true
  },
  service: {
    type: String,
    required: true,
    enum: [
      'Recruitment & Staffing',
      'HR Compliance & Onboarding', 
      'Performance Management',
      'Training & Development',
      'Payroll Management',
      'HR Analytics & Reporting'
    ]
  },
  companyName: {
    type: String,
    required: true
  },
  contactPerson: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: false,
      default: ""
    }
  },
  requirements: {
    type: String,
    required: true
  },
  budget: {
    type: String,
    enum: ['Under 5,000 AED', '5,000 - 10,000 AED', '10,000 - 25,000 AED', '25,000 - 50,000 AED', 'Above 50,000 AED', 'To be discussed'],
    default: 'To be discussed'
  },
  timeline: {
    type: String,
    enum: ['ASAP', 'Within 1 month', 'Within 3 months', 'Within 6 months', 'Flexible'],
    default: 'Flexible'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'quoted', 'accepted', 'rejected', 'completed'],
    default: 'pending'
  },
  adminResponse: {
    message: String,
    quotedPrice: Number,
    quotedTimeline: String,
    respondedAt: Date,
    respondedBy: {
      type: String,
      default: 'admin'
    }
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  notes: [{
    note: String,
    addedBy: {
      type: String,
      default: 'admin'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
quoteRequestSchema.index({ employerId: 1, status: 1 });
quoteRequestSchema.index({ status: 1, createdAt: -1 });
// Unique index to prevent duplicate quotations per employer per service
quoteRequestSchema.index({ employerId: 1, service: 1 }, { unique: false });
quoteRequestSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model('QuoteRequest', quoteRequestSchema);
