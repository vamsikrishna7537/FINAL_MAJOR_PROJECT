import express from 'express';
import AlertSubscriber from '../models/AlertSubscriber.js';

const router = express.Router();

// Predefined areas with coordinates (for dropdown)
export const AREAS = [
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Kochi', lat: 9.9312, lng: 76.2673 }
];

// Subscribe for alerts (name, phone, area) - no auth required
router.post('/', async (req, res) => {
  try {
    const { name, phone, latitude, longitude, areaName } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);
    let area = (areaName || '').trim();

    // If no coords, try to get from area name
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const found = AREAS.find((a) => a.name.toLowerCase() === area.toLowerCase());
      if (found) {
        lat = found.lat;
        lng = found.lng;
        area = found.name;
      } else {
        return res.status(400).json({ message: 'Please select an area or provide location' });
      }
    }

    const subscriber = new AlertSubscriber({
      name: name.trim(),
      phone: phone.trim().replace(/\s/g, ''),
      latitude: lat,
      longitude: lng,
      areaName: area || `${lat.toFixed(2)}, ${lng.toFixed(2)}`
    });

    await subscriber.save();
    res.status(201).json({
      message: 'You are now subscribed to disaster alerts for your area',
      subscriber: { name: subscriber.name, areaName: subscriber.areaName }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get areas list (for dropdown)
router.get('/areas', (req, res) => {
  res.json(AREAS);
});

// Get all subscribers (admin)
router.get('/', async (req, res) => {
  try {
    const subscribers = await AlertSubscriber.find().sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update subscriber (admin)
router.patch('/:id', async (req, res) => {
  try {
    const { name, phone, latitude, longitude, areaName } = req.body;
    const sub = await AlertSubscriber.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subscriber not found' });
    if (name?.trim()) sub.name = name.trim();
    if (phone?.trim() !== undefined) sub.phone = String(phone).trim().replace(/\s/g, '');
    if (latitude != null && longitude != null) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        sub.latitude = lat;
        sub.longitude = lng;
      }
    }
    if (areaName?.trim() !== undefined) sub.areaName = areaName.trim();
    await sub.save();
    res.json(sub);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete subscriber (admin)
router.delete('/:id', async (req, res) => {
  try {
    const sub = await AlertSubscriber.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subscriber not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
