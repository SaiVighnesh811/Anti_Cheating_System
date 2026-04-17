import mongoose from 'mongoose';

const loginActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  ipAddress: { type: String },
  deviceInfo: { type: String }
}, { timestamps: true });

const LoginActivity = mongoose.model('LoginActivity', loginActivitySchema);
export default LoginActivity;
