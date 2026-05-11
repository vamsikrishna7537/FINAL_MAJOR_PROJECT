import express from 'express';
import mongoose from 'mongoose';
import Disaster from '../models/Disaster.js';
import { getPrediction } from '../services/predictionHelper.js';
import { tryAutoAlert } from '../services/autoAlertService.js';

const router = express.Router();

// Get all disasters
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json([]);
  }
  try {
    const { type, status, minRisk } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (minRisk) filter.riskScore = { $gte: parseInt(minRisk) };

    const disasters = await Disaster.find(filter)
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(disasters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get disaster by ID
router.get('/:id', async (req, res) => {
  try {
    const disaster = await Disaster.findById(req.params.id);
    if (!disaster) {
      return res.status(404).json({ message: 'Disaster not found' });
    }
    res.json(disaster);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create disaster
router.post('/', async (req, res) => {
  try {
    const disaster = new Disaster(req.body);
    await disaster.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('disaster-update', disaster);

    // Auto-alert users in danger area when risk >= minRisk
    const d = disaster.toObject ? disaster.toObject() : disaster;
    await tryAutoAlert(d, io);

    res.status(201).json(disaster);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get AI prediction (uses AI service if available, else fallback)
router.post('/predict', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database not connected' });
  }
  try {
    const { latitude, longitude, rainfall, temperature, windSpeed, humidity } = req.body;

    const { risk_score, disaster_type } = await getPrediction(
      rainfall,
      temperature,
      windSpeed,
      humidity
    );

    const disaster = new Disaster({
      type: disaster_type,
      riskScore: risk_score,
      latitude: latitude ?? 28.6139,
      longitude: longitude ?? 77.209,
      details: {
        rainfall: rainfall ?? 0,
        temperature: temperature ?? 25,
        windSpeed: windSpeed ?? 0,
        humidity: humidity ?? 50
      }
    });

    await disaster.save();

    const io = req.app.get('io');
    if (io) io.emit('disaster-update', disaster);

    // Auto-alert users in danger area when risk >= minRisk
    const d = disaster.toObject ? disaster.toObject() : disaster;
    await tryAutoAlert(d, io);

    res.json({
      disaster,
      prediction: {
        riskScore: risk_score,
        disasterType: disaster_type
      }
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update disaster status
router.patch('/:id', async (req, res) => {
  try {
    const disaster = await Disaster.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!disaster) {
      return res.status(404).json({ message: 'Disaster not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('disaster-update', disaster);

    res.json(disaster);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete disaster
router.delete('/:id', async (req, res) => {
  try {
    const disaster = await Disaster.findByIdAndDelete(req.params.id);
    if (!disaster) {
      return res.status(404).json({ message: 'Disaster not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('disaster-deleted', req.params.id);

    res.json({ message: 'Disaster deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
