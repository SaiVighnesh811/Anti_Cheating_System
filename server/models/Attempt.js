import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedOptionIndex: { type: Number }
  }],
  score: { type: Number, default: 0 },
  status: { type: String, enum: ['in-progress', 'completed', 'terminated'], default: 'in-progress' },
  is_disqualified: { type: Boolean, default: false },
  violation_count: { type: Number, default: 0 },
  suspicion_score: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

const Attempt = mongoose.model('Attempt', attemptSchema);
export default Attempt;
