import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['mcq-text', 'mcq-image', 'fill-in-blank'], default: 'mcq-text' },
  questionText: { type: String },
  questionImage: { type: String },
  options: [{ type: String }],
  optionImages: [{ type: String }],
  correctOptionIndex: { type: Number, min: 0 },
  correctAnswerText: { type: String }
});

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  durationMinutes: { type: Number, required: true },
  startTime: { type: Date },
  endTime: { type: Date },
  questions: [questionSchema],
  allowedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const Exam = mongoose.model('Exam', examSchema);
export default Exam;
