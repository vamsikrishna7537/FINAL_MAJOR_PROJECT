/**
 * SMS service: Fast2SMS (India) primary, Twilio fallback.
 * Used for disaster alerts so users receive SMS when an alert is sent.
 */

import axios from 'axios';
import twilio from 'twilio';

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

/** Normalize to 10-digit Indian number for Fast2SMS (strip +91, spaces, etc.) */
function normalizeIndianPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Send SMS via Fast2SMS (India). numbers = array of 10-digit strings. */
async function sendViaFast2SMS(numbers, message) {
  const apiKey = (process.env.FAST2SMS_API_KEY || '').trim();
  if (!apiKey) return { sent: 0, provider: 'fast2sms', error: 'FAST2SMS_API_KEY not set' };

  const normalized = numbers.map(normalizeIndianPhone).filter(Boolean);
  if (normalized.length === 0) return { sent: 0, provider: 'fast2sms', error: 'No valid numbers' };

  try {
    const { data } = await axios.post(
      FAST2SMS_URL,
      {
        message: message.slice(0, 999),
        route: process.env.FAST2SMS_ROUTE || 'q',
        numbers: normalized.join(',')
      },
      {
        headers: {
          authorization: apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    const ok = data?.return === true || data?.request_id;
    const errMsg = data?.message || (Array.isArray(data?.msg) ? data.msg.join('; ') : data?.msg) || null;
    if (!ok && errMsg) {
      console.warn('[SMS] Fast2SMS:', errMsg);
    }
    return {
      sent: ok ? normalized.length : 0,
      provider: 'fast2sms',
      requestId: data?.request_id,
      error: ok ? null : (errMsg || 'Fast2SMS error')
    };
  } catch (err) {
    const res = err.response?.data;
    const msg = res?.message || (Array.isArray(res?.msg) ? res.msg.join('; ') : res?.msg) || err.message;
    console.error('[SMS] Fast2SMS error:', msg, res ? `(status ${err.response?.status})` : '');
    return { sent: 0, provider: 'fast2sms', error: msg };
  }
}

/** Send SMS via Twilio (international). */
async function sendViaTwilio(numbers, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!sid || !token || !from) return { sent: 0, provider: 'twilio', error: 'Twilio not configured' };

  const client = twilio(sid, token);
  const body = `ALERT: ${message}`.slice(0, 1600);
  let sent = 0;
  for (const num of numbers) {
    const to = num.replace(/\D/g, '').length === 10 ? `+91${num.replace(/\D/g, '')}` : num.startsWith('+') ? num : `+${num}`;
    try {
      await client.messages.create({ body, from, to });
      sent++;
    } catch (e) {
      console.error(`[SMS] Twilio failed for ${to}:`, e.message);
    }
  }
  return { sent, provider: 'twilio' };
}

/**
 * Send alert SMS to a list of phone numbers.
 * Uses Fast2SMS if FAST2SMS_API_KEY is set (India); otherwise Twilio if configured.
 * @param {string[]} phoneNumbers - Array of phone numbers (10-digit Indian or E.164)
 * @param {string} message - Alert message text
 * @returns {{ sent: number, provider: string, error?: string }}
 */
export async function sendAlertSms(phoneNumbers, message) {
  const phones = [...new Set(phoneNumbers)].filter(Boolean);
  if (phones.length === 0) return { sent: 0, provider: null, error: 'No phone numbers' };

  // Prefer Fast2SMS for Indian numbers when API key is set
  const fast2smsKey = process.env.FAST2SMS_API_KEY?.trim();
  if (fast2smsKey) {
    const result = await sendViaFast2SMS(phones, message);
    if (result.sent > 0) return result;
    // Fallback to Twilio on Fast2SMS failure (e.g. invalid key)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      return sendViaTwilio(phones, message);
    }
    return result;
  }

  return sendViaTwilio(phones, message);
}
