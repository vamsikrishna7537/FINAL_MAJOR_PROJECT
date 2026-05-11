import express from 'express';
import Report from '../models/Report.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

const router = express.Router();

// Submit report
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { description, latitude, longitude, type, name } = req.body;

    const report = new Report({
      userId: null,
      userName: name || 'Anonymous',
      image: req.file ? `/uploads/${req.file.filename}` : '',
      description,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      },
      type: type || 'other'
    });

    await report.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('new-report', report);

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all reports
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update report status
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('report-updated', report);
      if (status === 'approved') io.emit('report-approved', report);
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete report
router.delete('/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
