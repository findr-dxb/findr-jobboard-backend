const QuoteRequest = require('../model/QuoteRequestSchema');
const Employer = require('../model/EmployerSchema');

// Create a new quote request
exports.createQuoteRequest = async (req, res) => {
  try {
    const { service, requirements, budget, timeline } = req.body;
    const employerId = req.user.id;

    // Get employer details
    const employer = await Employer.findById(employerId);
    if (!employer) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Check if employer already has a quote request for this service
    const existingQuote = await QuoteRequest.findOne({
      employerId: employerId,
      service: service
    });

    if (existingQuote) {
      return res.status(400).json({ 
        success: false,
        message: `You have already requested a quotation for ${service}. Only one quotation per service is allowed.` 
      });
    }

    // Create quote request
    const quoteRequest = new QuoteRequest({
      employerId,
      service,
      companyName: employer.companyName || employer.name || 'Unknown Company',
      contactPerson: {
        name: employer.contactPerson?.name || employer.name || 'Unknown Contact',
        email: employer.email || 'no-email@example.com',
        phone: employer.contactPerson?.phone || employer.phoneNumber || 'Not provided'
      },
      requirements,
      budget,
      timeline
    });

    await quoteRequest.save();

    res.status(201).json({
      success: true,
      message: "Quote request submitted successfully",
      data: quoteRequest
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create quote request",
      error: error.message
    });
  }
};

// Get quote requests for admin
exports.getQuoteRequests = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const quoteRequests = await QuoteRequest.find(filter)
      .populate('employerId', 'companyName email phoneNumber')
      .populate('adminResponse.respondedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await QuoteRequest.countDocuments(filter);

    res.json({
      success: true,
      data: {
        quoteRequests,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch quote requests",
      error: error.message
    });
  }
};

// Get quote requests for employer
exports.getEmployerQuoteRequests = async (req, res) => {
  try {
    const employerId = req.user.id;
    
    const quoteRequests = await QuoteRequest.find({ employerId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: quoteRequests
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch quote requests",
      error: error.message
    });
  }
};

// Update quote request status (admin only)
exports.updateQuoteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse, priority, note } = req.body;
    const adminId = req.user.id;

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminResponse) {
      updateData.adminResponse = {
        ...adminResponse,
        respondedBy: adminId,
        respondedAt: new Date()
      };
    }
    if (note) {
      updateData.$push = {
        notes: {
          note,
          addedBy: adminId
        }
      };
    }

    const quoteRequest = await QuoteRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('employerId', 'companyName email phoneNumber');

    if (!quoteRequest) {
      return res.status(404).json({ message: "Quote request not found" });
    }

    res.json({
      success: true,
      message: "Quote request updated successfully",
      data: quoteRequest
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update quote request",
      error: error.message
    });
  }
};

// Get single quote request
exports.getQuoteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const quoteRequest = await QuoteRequest.findById(id)
      .populate('employerId', 'companyName email phoneNumber contactPerson')
      .populate('adminResponse.respondedBy', 'name email')
      .populate('notes.addedBy', 'name email');

    if (!quoteRequest) {
      return res.status(404).json({ message: "Quote request not found" });
    }

    res.json({
      success: true,
      data: quoteRequest
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch quote request",
      error: error.message
    });
  }
};
