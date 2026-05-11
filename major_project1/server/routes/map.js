import express from 'express';
import mongoose from 'mongoose';
import Disaster from '../models/Disaster.js';
import Shelter from '../models/Shelter.js';

const router = express.Router();

// Get heatmap data
router.get('/heatmap', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json([]);
  }
  try {
    const disasters = await Disaster.find({ status: 'active' });
    const heatmapData = disasters.map(disaster => ({
      lat: disaster.latitude,
      lng: disaster.longitude,
      intensity: disaster.riskScore / 100,
      _id: disaster._id,
      type: disaster.type,
      riskScore: disaster.riskScore,
      status: disaster.status,
      timestamp: disaster.timestamp,
      locationName: disaster.locationName || ''
    }));
    res.json(heatmapData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get shelters and hospitals
router.get('/shelters', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json([]);
  }
  try {
    const { type, lat, lng } = req.query;
    const filter = {};

    if (type) filter.type = type;

    let shelters = await Shelter.find(filter);

    // If lat/lng provided, sort by distance
    if (lat && lng) {
      shelters = shelters.map(shelter => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          shelter.latitude,
          shelter.longitude
        );
        return { ...shelter.toObject(), distance };
      }).sort((a, b) => a.distance - b.distance);
    }

    res.json(shelters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default router;
