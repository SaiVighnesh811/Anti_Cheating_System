import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, default: 'EXAM_DELETED' },
  examName: { type: String, required: true },
  examId: { type: mongoose.Schema.Types.ObjectId, required: true },
  deletedBy: {
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  timestamp: { type: Date, default: Date.now }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
