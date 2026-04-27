import express from 'express';
import Exam from '../models/Exam.js';
import AuditLog from '../models/AuditLog.js';
import Attempt from '../models/Attempt.js';
import ViolationLog from '../models/ViolationLog.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/exams
// @desc    Create a new exam
// @access  Private/Admin
router.post('/', protect, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  try {
    const { title, description, durationMinutes, questions, startTime, allowedStudents } = req.body;

    // Auto-derive endTime from startTime + duration
    const endTime = startTime
      ? new Date(new Date(startTime).getTime() + (durationMinutes * 60 * 1000))
      : null;

    const exam = new Exam({
      title,
      description,
      durationMinutes,
      startTime: startTime ? new Date(startTime) : null,
      endTime,
      questions,
      allowedStudents: allowedStudents || [],
      createdBy: req.user._id
    });

    const createdExam = await exam.save();
    res.status(201).json(createdExam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/exams
// @desc    Get exams (all for admin, active for student)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query = { isDeleted: false };

    // Admins and SuperAdmins can see everything including deleted if we want
    // But per user request: "Show all exams where isDeleted != true"
    // and "Deleted Exams (Optional) - Show in separate section"
    // So for admins, we return ALL exams (including deleted) to allow categorization
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      query = {}; // No filter for admins to allow "Deleted" section
    } else {
      // Students only see active, non-deleted exams
      query = { isActive: true, isDeleted: false };
    }

    let exams = await Exam.find(query)
      .select('-questions.correctOptionIndex -questions.correctAnswerText')
      .sort({ createdAt: -1 });

    // For students: filter out exams whose time window has already expired
    if (req.user.role === 'student') {
      const now = new Date();
      exams = exams.filter(exam => {
        // Compute the exam end time: explicit endTime OR startTime + duration
        let examEnd = null;
        if (exam.endTime) {
          examEnd = new Date(exam.endTime);
        } else if (exam.startTime && exam.durationMinutes) {
          examEnd = new Date(new Date(exam.startTime).getTime() + exam.durationMinutes * 60000);
        }
        
        // Filter by allowedStudents
        if (exam.allowedStudents && exam.allowedStudents.length > 0) {
          if (!exam.allowedStudents.map(id => id.toString()).includes(req.user._id.toString())) {
            return false;
          }
        }

        // If no end time computable, show exam (no window defined)
        if (!examEnd) return true;
        // Hide if the exam window has already passed
        return now <= examEnd;
      });
    }

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
      exam.questions.forEach(q => {
        q.correctOptionIndex = undefined;
        q.correctAnswerText = undefined;
      });
    }

    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/exams/:id
// @desc    Update an existing exam
// @access  Private/Admin
router.put('/:id', protect, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  try {
    const { title, description, durationMinutes, startTime, endTime, questions, allowedStudents } = req.body;
    const exam = await Exam.findById(req.params.id);

    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    exam.title = title || exam.title;
    exam.description = description || exam.description;
    exam.durationMinutes = durationMinutes !== undefined ? durationMinutes : exam.durationMinutes;

    // Recalculate endTime based on startTime and durationMinutes
    if (startTime) {
      exam.startTime = new Date(startTime);
    }
    
    if (exam.startTime) {
      exam.endTime = new Date(new Date(exam.startTime).getTime() + (exam.durationMinutes * 60 * 1000));
    }

    exam.questions = questions || exam.questions;
    if (allowedStudents !== undefined) exam.allowedStudents = allowedStudents;

    const updatedExam = await exam.save();
    res.json(updatedExam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/exams/:id
// @desc    Soft delete an exam and cleanup related data
// @access  Private/Admin
router.delete('/:id', protect, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Soft delete
    exam.isDeleted = true;
    exam.isActive = false;
    await exam.save();

    // Audit Log
    await AuditLog.create({
      examName: exam.title,
      examId: exam._id,
      deletedBy: {
        name: req.user.name,
        email: req.user.email
      }
    });

    // Cleanup related data
    await Attempt.deleteMany({ exam: exam._id });
    await ViolationLog.deleteMany({ exam: exam._id });

    res.json({ message: 'Exam deleted and related data cleaned up successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
