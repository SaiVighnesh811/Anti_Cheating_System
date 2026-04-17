import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import examRoutes from './routes/exam.js';
import attemptRoutes from './routes/attempt.js';
import reportRoutes from './routes/report.js';
import superadminRoutes from './routes/superadmin.js';
import User from './models/User.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/superadmin', superadminRoutes);

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB Atlas: onlineexam database');
    
    // Seed Super Admin
    try {
      const superAdminExists = await User.findOne({ email: 'superadmin1@gmail.com' });
      if (!superAdminExists) {
        await User.create({
          name: 'Super Admin',
          email: 'superadmin1@gmail.com',
          password: 'superadmin',
          role: 'superadmin'
        });
        console.log('Super Admin seeded successfully');
      }
    } catch (err) {
      console.error('Error seeding super admin:', err.message);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
  });
