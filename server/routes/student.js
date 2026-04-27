import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/students
// @desc    Get all students for admin selection
// @access  Private/Admin
router.get('/', protect, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const students = await User.find({ role: 'student' }).select('_id name email');
    res.json(students.map(s => ({ userId: s._id, name: s.name, email: s.email })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
