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

    const existingAttempt = await Attempt.findOne({ student: req.user._id, exam: examId, status: 'in-progress' });
    if (existingAttempt) {
      // Idempotent: return the existing attempt instead of creating duplicate or throwing 400
      existingAttempt.updatedAt = Date.now();
      await existingAttempt.save();
      return res.status(200).json(existingAttempt);
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    if (exam.isDeleted) {
      return res.status(400).json({ message: 'Exam is deleted' });
    }
    // Compute exam end: explicit endTime OR startTime + duration
    const examEndTime = exam.endTime
      ? new Date(exam.endTime)
      : (exam.startTime ? new Date(new Date(exam.startTime).getTime() + exam.durationMinutes * 60000) : null);

    if (examEndTime && new Date() > examEndTime) {
      return res.status(400).json({ message: 'This exam has expired' });
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
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    if (exam.isDeleted) {
      return res.status(400).json({ message: 'Exam is deleted' });
    }
    if (exam.endTime && new Date() > new Date(exam.endTime)) {
      return res.status(400).json({ message: 'This exam has ended' });
    }

    let score = 0;

    // Calculate score
    const processedAnswers = answers.map(ans => {
      const question = exam.questions.id(ans.questionId);
      if (question) {
        if (question.type === 'fill-in-blank') {
          const submittedText = (ans.fillText || '').trim().toLowerCase();
          const correctText = (question.correctAnswerText || '').trim().toLowerCase();
          if (submittedText === correctText && correctText !== '') {
            score++;
          }
        } else {
          if (question.correctOptionIndex === ans.selectedOptionIndex && typeof ans.selectedOptionIndex === 'number') {
            score++;
          }
        }
      }
      return {
        questionId: ans.questionId,
        selectedOptionIndex: ans.selectedOptionIndex,
        fillText: ans.fillText
      };
    });

    // Calculate violations and disqualification
    const allViolations = await ViolationLog.find({ attempt: attempt._id });
    const tabSwitches = allViolations.filter(v => v.type === 'TAB_SWITCH' || v.type === 'tab-switch' || v.type === 'window-blur').length;
    const fsExits = allViolations.filter(v => v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit').length;

    const violationCount = allViolations.length;
    const suspicionScore = (tabSwitches * 10) + (fsExits * 15);
    const isDisqualified = violationCount >= 5 || req.body.isDisqualified === true;

    attempt.answers = processedAnswers;
    attempt.score = score;
    attempt.violation_count = violationCount;
    attempt.suspicion_score = suspicionScore;
    attempt.is_disqualified = isDisqualified;
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
    if (req.user.role !== 'student') {
      return res.status(200).json({ message: 'Admins are excluded from violation tracking' });
    }
    let { type } = req.body;

    // Map legacy frontend types to new explicit backend types
    if (type === 'tab-switch') type = 'TAB_SWITCH';
    if (type === 'window-blur') type = 'TAB_SWITCH';
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

// @route   GET /api/attempts/live (Admin only)
// @desc    Get all currently in-progress exam attempts for live proctoring
// @access  Private/Admin
router.get('/live', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

    const activeAttempts = await Attempt.find({ status: 'in-progress' })
      .populate('student', 'name email role')
      .populate({ path: 'exam', select: 'title isDeleted', match: { isDeleted: { $ne: true } } })
      .sort('-startedAt');

    // Filter to only include student attempts (safety check) and non-deleted exams
    const studentAttempts = activeAttempts.filter(a => a.student && a.student.role === 'student' && a.exam != null);

    // Deduplicate older phantom duplicates from db before sending to frontend
    const uniqueStudentAttempts = [];
    const seenSet = new Set();
    studentAttempts.forEach(a => {
      const key = String(a.student._id) + '_' + String(a.exam._id);
      if (!seenSet.has(key)) {
        seenSet.add(key);
        uniqueStudentAttempts.push(a);
      }
    });

    // Attach violation counts for each attempt
    const liveData = await Promise.all(
      uniqueStudentAttempts.map(async (attempt) => {
        const allViolations = await ViolationLog.find({ attempt: attempt._id }).sort('-timestamp');
        const tabSwitches = allViolations.filter(v => v.type === 'TAB_SWITCH' || v.type === 'tab-switch').length;
        const fullscreenExits = allViolations.filter(v => v.type === 'FULLSCREEN_EXIT' || v.type === 'fullscreen-exit').length;
        const lastViolationType = allViolations.length > 0 ? allViolations[0].type : null;

        return {
          attemptId: attempt._id,
          student: attempt.student,
          exam: attempt.exam,
          startedAt: attempt.startedAt,
          totalViolations: allViolations.length,
          tabSwitches,
          fullscreenExits,
          lastViolationType
        };
      })
    );

    res.json(liveData);
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

    const logs = await ViolationLog.find()
      .populate('student', 'name email role')
      .populate({ path: 'exam', select: 'title isDeleted', match: { isDeleted: { $ne: true } } })
      .sort('-timestamp');

    const validLogs = logs.filter(log => log.exam != null);
    res.json(validLogs);
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
    const attempts = await Attempt.find()
      .populate('student', 'name email role')
      .populate({ path: 'exam', select: 'title isDeleted', match: { isDeleted: { $ne: true } } })
      .sort('-createdAt');

    const validAttempts = attempts.filter(a => a.exam != null);

    // Deduplicate in-progress attempts to remove legacy phantom duplicates
    const deduplicatedAttempts = [];
    const inProgressSet = new Set();

    validAttempts.forEach(a => {
      if (a.status === 'in-progress' && a.student && a.exam) {
        const key = String(a.student._id) + '_' + String(a.exam._id);
        if (!inProgressSet.has(key)) {
          inProgressSet.add(key);
          deduplicatedAttempts.push(a);
        }
      } else {
        deduplicatedAttempts.push(a);
      }
    });

    res.json(deduplicatedAttempts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attempts/my-attempts
// @desc    Get user's attempts
// @access  Private
router.get('/my-attempts', protect, async (req, res) => {
  try {
    const attempts = await Attempt.find({ student: req.user._id })
      .populate({ path: 'exam', select: 'title description durationMinutes isDeleted', match: { isDeleted: { $ne: true } } })
      .sort('-createdAt');

    const validAttempts = attempts.filter(a => a.exam != null);
    res.json(validAttempts);
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

// @route   GET /api/attempts/:id/violations
// @desc    Get violation list for a specific attempt (Student/Admin)
// @access  Private
router.get('/:id/violations', protect, async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

    // Allow student who owns the attempt OR an admin
    if (attempt.student.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const violations = await ViolationLog.find({ attempt: attempt._id }).sort('timestamp');
    res.json(violations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attempts/violations/by-exam/:examId
// @desc    Get violations for a specific exam (Admin only)
// @access  Private/Admin
router.get('/violations/by-exam/:examId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized' });

    const logs = await ViolationLog.find({ exam: req.params.examId })
      .populate('student', 'name email role')
      .populate({ path: 'exam', select: 'title isDeleted', match: { isDeleted: { $ne: true } } })
      .sort('-timestamp');

    const validLogs = logs.filter(log => log.exam != null);
    res.json(validLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
