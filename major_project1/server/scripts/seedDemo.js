/**
 * DEMO / TEST DATA - For college demo and evaluation only.
 * Seeds multiple disasters (Hyderabad + Chennai areas), alerts, SOS, and 10 users when DB is empty and DEMO_MODE=true.
 * Do NOT insert if real data already exists.
 */

import Disaster from '../models/Disaster.js';
import Alert from '../models/Alert.js';
import SOS from '../models/SOS.js';
import AlertSubscriber from '../models/AlertSubscriber.js';

const DEMO_USERS = [
  { name: 'Ramesh Kumar', phone: '9876543210', area: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Priya Sharma', phone: '9876543211', area: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { name: 'Vikram Singh', phone: '9876543212', area: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Anita Patel', phone: '9876543213', area: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Suresh Reddy', phone: '9876543214', area: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Meera Krishnan', phone: '9876543215', area: 'Chennai', lat: 13.01, lng: 80.22 },
  { name: 'Arun Gupta', phone: '9876543216', area: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Lakshmi Nair', phone: '9876543217', area: 'Kochi', lat: 9.9312, lng: 76.2673 },
  { name: 'Rajesh Verma', phone: '9876543218', area: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Divya Menon', phone: '9876543219', area: 'Chennai', lat: 12.97, lng: 80.22 }
];

// DEMO: 15 disasters (varied types) - alerts=0, SOS=0
const DEMO_DISASTERS = [
  { lat: 17.385, lng: 78.4867, locationName: 'Hyderabad', type: 'flood', riskScore: 85, severity: 'high' },
  { lat: 13.0827, lng: 80.2707, locationName: 'Chennai Central', type: 'flood', riskScore: 78, severity: 'high' },
  { lat: 13.21, lng: 80.32, locationName: 'North Chennai', type: 'cyclone', riskScore: 72, severity: 'high' },
  { lat: 13.01, lng: 80.22, locationName: 'Adyar', type: 'flood', riskScore: 68, severity: 'medium' },
  { lat: 12.97, lng: 80.22, locationName: 'OMR', type: 'flood', riskScore: 65, severity: 'medium' },
  { lat: 13.00, lng: 80.21, locationName: 'Guindy', type: 'flood', riskScore: 58, severity: 'medium' },
  { lat: 19.076, lng: 72.8777, locationName: 'Mumbai', type: 'flood', riskScore: 82, severity: 'high' },
  { lat: 28.6139, lng: 77.209, locationName: 'Delhi', type: 'fire', riskScore: 55, severity: 'medium' },
  { lat: 12.9716, lng: 77.5946, locationName: 'Bangalore', type: 'landslide', riskScore: 62, severity: 'medium' },
  { lat: 22.5726, lng: 88.3639, locationName: 'Kolkata', type: 'flood', riskScore: 75, severity: 'high' },
  { lat: 18.5204, lng: 73.8567, locationName: 'Pune', type: 'drought', riskScore: 48, severity: 'medium' },
  { lat: 9.9312, lng: 76.2673, locationName: 'Kochi', type: 'cyclone', riskScore: 70, severity: 'high' },
  { lat: 17.38, lng: 78.48, locationName: 'Secunderabad', type: 'flood', riskScore: 60, severity: 'medium' },
  { lat: 13.05, lng: 80.25, locationName: 'T Nagar', type: 'flood', riskScore: 52, severity: 'medium' },
  { lat: 13.15, lng: 80.28, locationName: 'Ambattur', type: 'landslide', riskScore: 45, severity: 'low' }
];

export async function seedDemoData() {
  if (process.env.DEMO_MODE !== 'true') {
    return;
  }

  const count = await Disaster.countDocuments();
  if (count > 0) {
    return; // Real data exists; do not insert demo data
  }

  try {
    const now = new Date();

    // DEMO: Insert 15 disasters with timestamps spread over last 7 days (so prediction trend lines show)
    for (let i = 0; i < DEMO_DISASTERS.length; i++) {
      const d = DEMO_DISASTERS[i];
      const ts = new Date(now);
      ts.setDate(ts.getDate() - (6 - (i % 7))); // spread across 7 dates
      ts.setHours(9 + (i % 8), (i * 17) % 60, 0, 0);
      await Disaster.create({
        type: d.type,
        riskScore: d.riskScore,
        severity: d.severity,
        status: 'active',
        latitude: d.lat,
        longitude: d.lng,
        locationName: d.locationName,
        timestamp: ts,
        predictedBy: 'DEMO'
      });
    }

    // DEMO: No alerts, no SOS (dashboard shows 0, 0)
    // DEMO: Insert 10 users (alert subscribers)
    for (const u of DEMO_USERS) {
      await AlertSubscriber.create({
        name: u.name,
        phone: u.phone,
        latitude: u.lat,
        longitude: u.lng,
        areaName: u.area
      });
    }

    console.log('[DEMO/TEST] Seeded 15 disasters, 0 alerts, 0 SOS, 10 users.');
  } catch (err) {
    console.error('[DEMO/TEST] Seed failed:', err.message);
  }
}
