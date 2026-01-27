const User = require("../model/UserSchemas");
const Employer = require("../model/EmployerSchema");

// Get all jobseekers with pagination
exports.getJobseekers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const [users, totalCount] = await Promise.all([
      User.find(searchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password'),
      User.countDocuments(searchQuery)
    ]);

    // Return users with loginStatus field (no transformation needed)
    const transformedUsers = users.map(user => ({
      ...user.toObject()
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      data: {
        users: transformedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching jobseekers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobseekers',
      error: error.message
    });
  }
};

// Get all employers with pagination
exports.getEmployers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { companyName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } },
          { industry: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const [employers, totalCount] = await Promise.all([
      Employer.find(searchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password'),
      Employer.countDocuments(searchQuery)
    ]);

    // Return employers with loginStatus field (no transformation needed)
    const transformedEmployers = employers.map(employer => ({
      ...employer.toObject()
    }));

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      data: {
        users: transformedEmployers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employers',
      error: error.message
    });
  }
};

// Block/Unblock user
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'active' or 'blocked'

    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "blocked"'
      });
    }

    // Try to find user in both collections
    let user = await User.findById(userId);
    let userType = 'jobseeker';
    
    if (!user) {
      user = await Employer.findById(userId);
      userType = 'employer';
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update the loginStatus
    user.loginStatus = status;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${status === 'blocked' ? 'blocked' : 'unblocked'} successfully`,
      data: {
        userId: user._id,
        userType,
        loginStatus: user.loginStatus
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId, userType } = req.params;

    let user;
    if (userType === 'jobseeker') {
      user = await User.findById(userId).select('-password');
    } else if (userType === 'employer') {
      user = await Employer.findById(userId).select('-password');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};
