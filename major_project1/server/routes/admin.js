import express from 'express';
import mongoose from 'mongoose';
import Disaster from '../models/Disaster.js';
import User from '../models/User.js';
import Alert from '../models/Alert.js';
import SOS from '../models/SOS.js';
import Report from '../models/Report.js';
import { getSettings, updateSettings } from '../models/Settings.js';

const router = express.Router();

// Get settings (auto-alert, min risk)
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ autoAlert: !!settings.autoAlert, minRisk: settings.minRisk ?? 70 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update settings
router.patch('/settings', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database not connected. Ensure MongoDB is running.' });
    }
    const { autoAlert, minRisk } = req.body ?? {};
    const settings = await updateSettings({
      autoAlert: autoAlert === true || autoAlert === 'true',
      minRisk: minRisk != null ? Math.min(100, Math.max(0, Number(minRisk))) : 70
    });
    res.json({ autoAlert: !!settings.autoAlert, minRisk: settings.minRisk ?? 70 });
  } catch (error) {
    console.error('[Admin] PATCH /settings error:', error);
    res.status(500).json({ message: error.message || 'Failed to save settings' });
  }
});

const emptyStats = {
  totalAlerts: 0,
  activeUsers: 0,
  activeDisasters: 0,
  totalSOS: 0,
  pendingReports: 0,
  totalReports: 0,
  recentIncidents: [],
  disasterDistribution: [],
  alertsBySeverity: []
};

const emptyAnalytics = {
  predictionTrends: [],
  disasterDistribution: [],
  riskDistribution: []
};

// Get dashboard stats
router.get('/stats', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(emptyStats);
  }
  try {
    const [
      totalAlerts,
      activeUsers,
      activeDisasters,
      totalSOS,
      pendingReports,
      totalReports
    ] = await Promise.all([
      Alert.countDocuments(),
      User.countDocuments({ role: 'user' }),
      Disaster.countDocuments({ status: 'active' }),
      SOS.countDocuments({ resolved: false }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments()
    ]);

    // Get recent incidents
    const recentIncidents = await Disaster.find()
      .sort({ timestamp: -1 })
      .limit(10);

    // Get disaster distribution
    const disasterDistribution = await Disaster.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avgRisk: { $avg: '$riskScore' }
        }
      }
    ]);

    // Get alerts by severity
    const alertsBySeverity = await Alert.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalAlerts,
      activeUsers,
      activeDisasters,
      totalSOS,
      pendingReports,
      totalReports,
      recentIncidents,
      disasterDistribution,
      alertsBySeverity
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get analytics data
router.get('/analytics', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(emptyAnalytics);
  }
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Prediction trends
    const predictionTrends = await Disaster.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 },
          avgRisk: { $avg: '$riskScore' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Disaster distribution
    const disasterDistribution = await Disaster.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Risk score distribution
    const riskDistribution = await Disaster.aggregate([
      {
        $bucket: {
          groupBy: '$riskScore',
          boundaries: [0, 25, 50, 75, 100],
          default: 'other',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    res.json({
      predictionTrends,
      disasterDistribution,
      riskDistribution
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
