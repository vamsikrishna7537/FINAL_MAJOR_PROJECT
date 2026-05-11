/**
 * Auto-alert: when a disaster's risk matches threshold, send alert + SMS to users in danger area.
 * Only users/subscribers whose location falls within the danger radius receive alerts.
 */

import Alert from '../models/Alert.js';
import User from '../models/User.js';
import AlertSubscriber from '../models/AlertSubscriber.js';
import { sendAlertSms } from './smsService.js';
import { getSettings } from '../models/Settings.js';

const DANGER_RADIUS_KM = 25; // km around disaster location

/** Haversine distance in km between two lat/lng points */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Get phone numbers of users/subscribers within danger radius only */
async function getPhonesInDangerArea(lat, lng, radiusKm) {
  const phones = new Set();
  const delta = (radiusKm * 1.2) / 111; // bounding box for DB query, then filter by haversine
  const [users, subs] = await Promise.all([
    User.find({ 'location.latitude': { $gte: lat - delta, $lte: lat + delta }, 'location.longitude': { $gte: lng - delta, $lte: lng + delta } }).lean(),
    AlertSubscriber.find({ latitude: { $gte: lat - delta, $lte: lat + delta }, longitude: { $gte: lng - delta, $lte: lng + delta } }).lean()
  ]);
  for (const u of users) {
      const ulat = u.location?.latitude;
      const ulng = u.location?.longitude;
      if (ulat != null && ulng != null && distanceKm(lat, lng, ulat, ulng) <= radiusKm && u.phone) {
        phones.add(String(u.phone));
      }
    }
  for (const s of subs) {
    if (distanceKm(lat, lng, s.latitude, s.longitude) <= radiusKm && s.phone) {
      phones.add(String(s.phone));
    }
  }
  return phones;
}

/**
 * Send auto-alert when disaster risk >= minRisk (from settings).
 * Creates alert, notifies only users in danger area via SMS, emits real-time.
 * @param {Object} disaster - Mongoose disaster doc
 * @param {Object} io - Socket.io instance
 * @returns {Promise<{ sent: boolean, smsSent?: number }>}
 */
export async function tryAutoAlert(disaster, io) {
  try {
    const settings = await getSettings();
    if (!settings.autoAlert || (disaster.riskScore || 0) < (settings.minRisk || 70)) {
      return { sent: false };
    }

    const lat = disaster.latitude ?? disaster.location?.latitude;
    const lng = disaster.longitude ?? disaster.location?.longitude;
    const locName = disaster.locationName || 'the area';
    const type = disaster.type || 'disaster';
    const risk = disaster.riskScore ?? 0;
    const radiusKm = disaster.details?.radiusKm ?? DANGER_RADIUS_KM;

    const message = `AUTO ALERT: High ${type} risk (${risk}%) in ${locName}. You are in the affected area. Stay safe and follow local authorities.`;

    const alertDoc = new Alert({
      message,
      type: 'disaster',
      severity: risk >= 80 ? 'critical' : risk >= 70 ? 'high' : 'medium',
      location: lat != null && lng != null
        ? { latitude: lat, longitude: lng, radius: radiusKm }
        : null
    });

    const phones = lat != null && lng != null ? await getPhonesInDangerArea(lat, lng, radiusKm) : new Set();

    alertDoc.usersNotified = [];
    await alertDoc.save();

    const phoneList = Array.from(phones);
    let smsSent = 0;
    if (phoneList.length > 0) {
      const result = await sendAlertSms(phoneList, message);
      smsSent = result.sent || 0;
      if (smsSent > 0) {
        console.log(`[Auto-Alert] SMS sent to ${smsSent} user(s) for ${type} at ${locName} (Risk: ${risk}%)`);
      }
    }

    if (io) io.emit('new-alert', alertDoc);
    return { sent: true, smsSent };
  } catch (err) {
    console.error('[Auto-Alert] Error:', err.message);
    return { sent: false };
  }
}
