import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true, min: 0 } // index of the options array
});

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  durationMinutes: { type: Number, required: true },
  startTime: { type: Date },
  endTime: { type: Date },
  questions: [questionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Exam = mongoose.model('Exam', examSchema);
export default Exam;
