import express from 'express';
import SOS from '../models/SOS.js';
import { sendSosAlertEmail } from '../services/emailService.js';

const router = express.Router();

// Send SOS (saves SOS, emits real-time, sends email via SMTP if configured)
router.post('/', async (req, res) => {
  try {
    const { latitude, longitude, name, phone } = req.body;

    const sos = new SOS({
      userId: null,
      location: { latitude, longitude },
      userName: name || 'Anonymous',
      userPhone: phone || ''
    });

    await sos.save();

    // Send email alert via SMTP (if SMTP and SOS_ALERT_EMAIL configured)
    const emailResult = await sendSosAlertEmail(sos.toObject());
    if (emailResult.sent) {
      console.log('[SOS] Email alert sent via SMTP');
    } else if (emailResult.error) {
      console.warn('[SOS] Email not sent:', emailResult.error);
    }

    // Emit real-time SOS alert
    const io = req.app.get('io');
    io.emit('sos-alert', {
      ...sos.toObject(),
      user: {
        name: sos.userName || 'Anonymous',
        phone: sos.userPhone || ''
      }
    });

    res.status(201).json({
      message: 'SOS alert sent successfully',
      sos,
      emailSent: emailResult.sent
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all SOS alerts
router.get('/', async (req, res) => {
  try {
    const { resolved } = req.query;
    const filter = {};

    if (resolved !== undefined) {
      filter.resolved = resolved === 'true';
    }

    const sosList = await SOS.find(filter)
      .sort({ time: -1 });

    res.json(sosList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resolve SOS
router.patch('/:id/resolve', async (req, res) => {
  try {
    const sos = await SOS.findById(req.params.id);
    
    if (!sos) {
      return res.status(404).json({ message: 'SOS not found' });
    }

    sos.resolved = true;
    sos.resolvedAt = new Date();
    sos.notes = req.body.notes;
    await sos.save();

    // Emit update
    const io = req.app.get('io');
    io.emit('sos-resolved', sos);

    res.json(sos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
