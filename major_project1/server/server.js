import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRoutes from './routes/auth.js';
import disasterRoutes from './routes/disasters.js';
import alertRoutes from './routes/alerts.js';
import sosRoutes from './routes/sos.js';
import reportRoutes from './routes/reports.js';
import mapRoutes from './routes/map.js';
import adminRoutes from './routes/admin.js';
import subscribeRoutes from './routes/subscribe.js';
import { schedulePrediction } from './services/predictionService.js';
import { seedDemoData } from './scripts/seedDemo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(',').map((u) => u.trim())
      : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/disasters', disasterRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscribe', subscribeRoutes);

// Root: redirect to dashboard (API runs here; frontend runs on 5173)
app.get('/', (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Disaster Dashboard – API</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .box { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 420px; text-align: center; }
    h1 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    p { margin: 0 0 1.5rem; color: #94a3b8; font-size: 0.95rem; }
    a { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 600; }
    a:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Disaster Awareness Dashboard – API</h1>
    <p>This is the backend. The dashboard UI runs on a different port.</p>
    <a href="${clientUrl}">Open Dashboard →</a>
  </div>
</body>
</html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Join room for location-based updates
  socket.on('join-location', (data) => {
    socket.join(`location-${data.lat}-${data.lng}`);
  });
});

// Make io available to routes
app.set('io', io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-db')
  .then(async () => {
    console.log('MongoDB connected');
    // DEMO / TEST: Seed one disaster, alert, SOS when DB is empty and DEMO_MODE=true (evaluation only)
    await seedDemoData();
    // Start scheduled prediction service
    schedulePrediction(io);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };
