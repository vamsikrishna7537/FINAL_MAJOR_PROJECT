import express from 'express';
import Alert from '../models/Alert.js';
import User from '../models/User.js';
import AlertSubscriber from '../models/AlertSubscriber.js';
import { sendAlertSms } from '../services/smsService.js';

const router = express.Router();

/** Haversine distance in km */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Get all phone numbers to notify (Users + AlertSubscribers) in area or all */
async function getPhonesToNotify(notifyAll, location, radius) {
  const rad = parseFloat(radius) || 20;
  const phones = new Set();

  if (notifyAll) {
    const [users, subs] = await Promise.all([User.find(), AlertSubscriber.find()]);
    users.forEach((u) => { if (u.phone) phones.add(String(u.phone).trim()); });
    subs.forEach((s) => { if (s.phone) phones.add(String(s.phone).trim()); });
  } else if (location && location.latitude != null && location.longitude != null) {
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      const [users, subs] = await Promise.all([User.find(), AlertSubscriber.find()]);
      users.forEach((u) => {
        if (u.phone && u.location?.latitude != null && u.location?.longitude != null) {
          if (distanceKm(lat, lng, u.location.latitude, u.location.longitude) <= rad) {
            phones.add(String(u.phone).trim());
          }
        }
      });
      subs.forEach((s) => {
        if (s.phone && s.latitude != null && s.longitude != null) {
          if (distanceKm(lat, lng, s.latitude, s.longitude) <= rad) {
            phones.add(String(s.phone).trim());
          }
        }
      });
      if (phones.size === 0) {
        subs.forEach((s) => { if (s.phone) phones.add(String(s.phone).trim()); });
        users.forEach((u) => { if (u.phone) phones.add(String(u.phone).trim()); });
      }
    } else {
      const [users, subs] = await Promise.all([User.find(), AlertSubscriber.find()]);
      users.forEach((u) => { if (u.phone) phones.add(String(u.phone).trim()); });
      subs.forEach((s) => { if (s.phone) phones.add(String(s.phone).trim()); });
    }
  } else {
    const [users, subs] = await Promise.all([User.find(), AlertSubscriber.find()]);
    users.forEach((u) => { if (u.phone) phones.add(String(u.phone).trim()); });
    subs.forEach((s) => { if (s.phone) phones.add(String(s.phone).trim()); });
  }

  return Array.from(phones);
}

// Send alert (saves alert, notifies users + subscribers in area, sends SMS)
router.post('/send', async (req, res) => {
  try {
    const { message, type, severity, location, radius, notifyAll } = req.body;

    const alert = new Alert({
      message,
      type,
      severity,
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radius || 10
      } : null
    });

    const phones = await getPhonesToNotify(notifyAll, location, radius || 20);
    await alert.save();

    // Send SMS to users + subscribers (Fast2SMS / Twilio)
    let smsSent = 0;
    let smsError = null;
    if (phones.length > 0) {
      const smsResult = await sendAlertSms(phones, message);
      smsSent = smsResult.sent || 0;
      smsError = smsResult.error || null;
      if (smsSent > 0) {
        console.log(`[Alerts] SMS sent to ${smsSent} user(s) via ${smsResult.provider}`);
      } else if (smsError) {
        console.warn('[Alerts] SMS not sent:', smsError);
      }
    }

    // Emit real-time alert to ALL connected clients (users see popup)
    const io = req.app.get('io');
    if (io) {
      const payload = alert.toObject ? alert.toObject() : JSON.parse(JSON.stringify(alert));
      io.emit('new-alert', payload);
    }

    res.status(201).json({
      alert,
      usersNotified: phones.length,
      smsSent,
      smsError
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get alert history
router.get('/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = await Alert.find()
      .populate('usersNotified', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get alert by ID
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('usersNotified', 'name email');
    
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
