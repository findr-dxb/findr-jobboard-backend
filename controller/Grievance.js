const Grievance = require('../model/Grievance');
const User = require('../model/UserSchemas');

exports.addGrievance = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    let userId = null;

    if (req.user && req.user.id) {
      userId = req.user.id;
    }

    const grievance = new Grievance({
      userId: userId,
      name,
      email,
      subject,
      message
    });

    await grievance.save();

    res.status(201).json({
      success: true,
      message: "Your message has been submitted successfully. We'll get back to you within 24 hours.",
      data: grievance
    });

  } catch (error) {
    console.error('Error creating grievance:', error);
    res.status(500).json({
      success: false,
      message: "Failed to submit your message",
      error: error.message
    });
  }
};

exports.getGrievances = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const grievances = await Grievance.find({})
      .populate('userId', 'name email fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Grievance.countDocuments({});

    res.json({
      success: true,
      data: {
        grievances,
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
      message: "Failed to fetch grievances",
      error: error.message
    });
  }
};

exports.getUserGrievances = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const grievances = await Grievance.find({ userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: grievances
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch your messages",
      error: error.message
    });
  }
};

exports.updateGrievance = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, subject, message } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (subject) updateData.subject = subject;
    if (message) updateData.message = message;

    const grievance = await Grievance.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('userId', 'name email fullName');

    if (!grievance) {
      return res.status(404).json({ 
        success: false,
        message: "Grievance not found" 
      });
    }

    res.json({
      success: true,
      message: "Grievance updated successfully",
      data: grievance
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update grievance",
      error: error.message
    });
  }
};

exports.getGrievance = async (req, res) => {
  try {
    const { id } = req.params;
    
    const grievance = await Grievance.findById(id)
      .populate('userId', 'name email fullName');

    if (!grievance) {
      return res.status(404).json({ 
        success: false,
        message: "Grievance not found" 
      });
    }

    res.json({
      success: true,
      data: grievance
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch grievance",
      error: error.message
    });
  }
};

