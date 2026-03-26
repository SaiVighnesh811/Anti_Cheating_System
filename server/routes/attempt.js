import express from 'express';
import Attempt from '../models/Attempt.js';
import Exam from '../models/Exam.js';
import ViolationLog from '../models/ViolationLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/attempts/start
// @desc    Start a new exam attempt
// @access  Private
router.post('/start', protect, async (req, res) => {
  try {
    const { examId } = req.body;
    
    // Check if an attempt already exists and is in-progress
    const existingAttempt = await Attempt.findOne({ student: req.user._id, exam: examId, status: 'in-progress' });
    if (existingAttempt) {
      return res.status(400).json({ message: 'Attempt already in progress' });
    }

    const attempt = new Attempt({
      student: req.user._id,
      exam: examId
    });

    const createdAttempt = await attempt.save();
    res.status(201).json(createdAttempt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/attempts/:id/submit
// @desc    Submit an exam attempt
// @access  Private
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { answers } = req.body;
    const attempt = await Attempt.findById(req.params.id);
    
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.student.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (attempt.status !== 'in-progress') {
      return res.status(400).json({ message: 'Attempt is already completed' });
    }

    const exam = await Exam.findById(attempt.exam);
    let score = 0;

    // Calculate score
    const processedAnswers = answers.map(ans => {
      const question = exam.questions.id(ans.questionId);
      if (question && question.correctOptionIndex === ans.selectedOptionIndex) {
        score++;
      }
      return {
        questionId: ans.questionId,
        selectedOptionIndex: ans.selectedOptionIndex
      };
    });

    attempt.answers = processedAnswers;
    attempt.score = score;
    attempt.status = 'completed';
    attempt.completedAt = Date.now();

    await attempt.save();
    res.json(attempt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/attempts/:id/violation
// @desc    Log a cheating violation
// @access  Private
router.post('/:id/violation', protect, async (req, res) => {
  try {
    let { type } = req.body;
    
    // Map legacy frontend types to new explicit backend types
    if (type === 'tab-switch') type = 'TAB_SWITCH';
    if (type === 'window-blur') type = 'MINIMIZE';
    if (type === 'fullscreen-exit') type = 'FULLSCREEN_EXIT';

    const attempt = await Attempt.findById(req.params.id);
    
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    
    const violation = new ViolationLog({
      attempt: attempt._id,
      student: req.user._id,
      exam: attempt.exam,
      type
    });

    await violation.save();
    res.status(201).json({ message: 'Violation logged' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attempts/violations/all (Admin only)
// @desc    Get all violation logs
// @access  Private/Admin
router.get('/violations/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
    
    const logs = await ViolationLog.find().populate('student', 'name email').populate('exam', 'title').sort('-timestamp');
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attempts/all
// @desc    Get all attempts (Admin only)
// @access  Private/Admin
router.get('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });
    const attempts = await Attempt.find().populate('student', 'name email').populate('exam', 'title').sort('-createdAt');
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attempts/my-attempts
// @desc    Get user's attempts
// @access  Private
router.get('/my-attempts', protect, async (req, res) => {
  try {
    const attempts = await Attempt.find({ student: req.user._id }).populate('exam', 'title description durationMinutes').sort('-createdAt');
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attempts/:id/review
// @desc    Get detailed review of a completed attempt, including correct answers
// @access  Private
router.get('/:id/review', protect, async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id)
      .populate('exam', 'title description durationMinutes questions');
    
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });
    if (attempt.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (attempt.status !== 'completed') {
      return res.status(400).json({ message: 'Review only available for completed exams' });
    }

    // Include the violation logs for this attempt
    const violations = await ViolationLog.find({ attempt: attempt._id }).sort('timestamp');

    res.json({ attempt, violations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
