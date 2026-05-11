/**
 * SMTP email service for SOS alerts.
 * Sends an email to admins when someone clicks the SOS button.
 */

import nodemailer from 'nodemailer';

function getTransporter() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  // Gmail App Passwords: remove spaces (displayed as "xxxx xxxx xxxx xxxx")
  const pass = (process.env.SMTP_PASS || '').trim().replace(/\s/g, '');
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass }
  });
}

/**
 * Send SOS alert email to configured recipients.
 * @param {Object} sos - { userName, userPhone, location: { latitude, longitude }, time }
 * @returns {{ sent: boolean, error?: string }}
 */
export async function sendSosAlertEmail(sos) {
  const transporter = getTransporter();
  const to = (process.env.SOS_ALERT_EMAIL || process.env.ADMIN_EMAIL || '').trim();
  if (!transporter || !to) {
    return { sent: false, error: !transporter ? 'SMTP not configured' : 'SOS_ALERT_EMAIL not set' };
  }

  const name = sos.userName || 'Anonymous';
  const phone = sos.userPhone || '—';
  const lat = sos.location?.latitude ?? sos.latitude ?? '—';
  const lng = sos.location?.longitude ?? sos.longitude ?? '—';
  const time = sos.time ? new Date(sos.time).toLocaleString() : new Date().toLocaleString();
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const subject = `[SOS ALERT] ${name} needs help – Disaster Dashboard`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:500px;padding:20px;">
  <h2 style="color:#dc2626;">SOS Alert</h2>
  <p>A user has requested emergency assistance.</p>
  <table style="border-collapse:collapse;width:100%;">
    <tr><td style="padding:6px 0;font-weight:bold;">Name:</td><td>${name}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Phone:</td><td>${phone}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Location:</td><td>${lat}, ${lng}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">Time:</td><td>${time}</td></tr>
  </table>
  <p style="margin-top:16px;">
    <a href="${mapsUrl}" style="color:#2563eb;">Open in Google Maps</a>
  </p>
  <p style="margin-top:20px;font-size:12px;color:#6b7280;">Disaster Awareness Dashboard – SOS</p>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'sos@disaster-dashboard.local',
      to: to.split(',').map((e) => e.trim()).filter(Boolean),
      subject,
      html,
      text: `SOS Alert: ${name} (${phone}) at ${lat}, ${lng} – ${time}\n${mapsUrl}`
    });
    return { sent: true };
  } catch (err) {
    const msg = err.response || err.message || String(err);
    console.error('[Email] SOS alert failed:', msg);
    return { sent: false, error: msg };
  }
}
