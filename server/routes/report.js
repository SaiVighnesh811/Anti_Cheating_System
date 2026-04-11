import express from 'express';
import Attempt from '../models/Attempt.js';
import ViolationLog from '../models/ViolationLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/report/:studentId/:examId
// @desc    Get detailed report data for a specific student's exam attempt
// @access  Private/Admin
router.get('/:studentId/:examId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { studentId, examId } = req.params;

    // Fetch the specific attempt
    const attempt = await Attempt.findOne({ student: studentId, exam: examId })
      .populate('student', 'name email role')
      .populate('exam', 'title description durationMinutes questions');

    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found for this student and exam' });
    }

    // Fetch all violations for this attempt
    const violations = await ViolationLog.find({ attempt: attempt._id }).sort('timestamp');

    res.json({
      attempt,
      violations
    });
  } catch (error) {
    console.error('Error generating report data:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
