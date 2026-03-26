import mongoose from 'mongoose';

const violationLogSchema = new mongoose.Schema({
  attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  type: { type: String, enum: ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'MINIMIZE', 'tab-switch', 'window-blur', 'multiple-login', 'terminated', 'fullscreen-exit'], required: true },
  timestamp: { type: Date, default: Date.now }
});

const ViolationLog = mongoose.model('ViolationLog', violationLogSchema);
export default ViolationLog;
