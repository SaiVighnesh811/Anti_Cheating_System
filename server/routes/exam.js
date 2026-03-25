import express from 'express';
import Exam from '../models/Exam.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/exams
// @desc    Create a new exam
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, durationMinutes, questions } = req.body;
    
    const exam = new Exam({
      title,
      description,
      durationMinutes,
      questions,
      createdBy: req.user._id
    });
    
    const createdExam = await exam.save();
    res.status(201).json(createdExam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/exams
// @desc    Get all active exams
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const exams = await Exam.find({ isActive: true }).select('-questions.correctOptionIndex');
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/exams/:id
// @desc    Get exam completely (admin) or without answers (student)
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    
    if (req.user.role !== 'admin') {
      // Students should not see the correct options before finishing
      exam.questions.forEach(q => q.correctOptionIndex = undefined);
    }
    
    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
