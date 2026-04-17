import express from 'express';
import User from '../models/User.js';
import Exam from '../models/Exam.js';
import LoginActivity from '../models/LoginActivity.js';
import Attempt from '../models/Attempt.js';
import ViolationLog from '../models/ViolationLog.js';
import AuditLog from '../models/AuditLog.js';
import { protect, superAdminOnly } from '../middleware/auth.js';

const router = express.Router();

// Apply middleware to all routes in this file
router.use(protect, superAdminOnly);

// @route   GET /api/superadmin/users
// @access  Private (Super Admin Only)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'superadmin' } }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/superadmin/login-activities
// @access  Private (Super Admin Only)
router.get('/login-activities', async (req, res) => {
  try {
    const activities = await LoginActivity.find().sort({ createdAt: -1 });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/superadmin/exams
// @access  Private (Super Admin Only)
router.get('/exams', async (req, res) => {
  try {
    const exams = await Exam.find()
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/superadmin/delete-user/:id
// @access  Private (Super Admin Only)
router.delete('/delete-user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if the user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cascade delete all related records
    await User.findByIdAndDelete(id);
    await LoginActivity.deleteMany({ user: id });
    await Attempt.deleteMany({ student: id });
    await ViolationLog.deleteMany({ student: id });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/superadmin/audit-logs
// @access  Private (Super Admin Only)
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
