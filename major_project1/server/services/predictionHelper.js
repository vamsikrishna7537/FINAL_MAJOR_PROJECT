import axios from 'axios';

/**
 * Fallback predictor when AI service is not available.
 * Uses IMD/WMO meteorological thresholds for disaster classification.
 * Reference: IMD India, WMO guidelines, NOAA thresholds.
 */
function fallbackPredict(rainfall = 0, temperature = 25, windSpeed = 0, humidity = 50) {
  const r = Number(rainfall) || 0;   // mm
  const t = Number(temperature) || 25; // °C
  const w = Number(windSpeed) || 0;  // km/h
  const h = Number(humidity) || 50;  // %

  let risk_score = 20;
  let disaster_type = 'other';

  // Flood: IMD heavy rain > 64.5 mm/24h, very heavy > 124.5 mm; high humidity amplifies
  if (r >= 125 && h >= 70) {
    disaster_type = 'flood';
    risk_score = Math.min(98, 65 + (r / 200) * 25 + (h - 70) * 0.2);
  } else if (r >= 65 && h >= 75) {
    disaster_type = 'flood';
    risk_score = Math.min(90, 50 + (r / 100) * 30 + (h - 70) * 0.15);
  } else if (r >= 40 && h >= 80) {
    disaster_type = 'flood';
    risk_score = Math.min(80, 40 + (r / 50) * 30);
  } else if (r >= 20 && h >= 85) {
    disaster_type = 'flood';
    risk_score = Math.min(70, 35 + r * 1.2);

  // Cyclone: WMO gale > 62 km/h, storm > 88 km/h; heavy rain increases risk
  } else if (w >= 90 && r >= 20) {
    disaster_type = 'cyclone';
    risk_score = Math.min(98, 70 + (w - 80) * 0.3 + (r / 50) * 15);
  } else if (w >= 63 && r >= 10) {
    disaster_type = 'cyclone';
    risk_score = Math.min(92, 55 + (w - 50) * 0.5 + (r / 30) * 10);
  } else if (w >= 50 && r >= 5) {
    disaster_type = 'cyclone';
    risk_score = Math.min(82, 45 + (w - 40) * 0.6);

  // Fire: high temp, low humidity (NFDRS-style)
  } else if (t >= 38 && h <= 30) {
    disaster_type = 'fire';
    risk_score = Math.min(95, 60 + (t - 35) * 2 + (100 - h) * 0.2);
  } else if (t >= 35 && h <= 40) {
    disaster_type = 'fire';
    risk_score = Math.min(85, 50 + (t - 32) * 2 + (100 - h) * 0.15);
  } else if (t >= 32 && h <= 35) {
    disaster_type = 'fire';
    risk_score = Math.min(75, 40 + (t - 28) * 2);

  // Landslide: IMD criteria - heavy rain on slopes, moderate temp
  } else if (r >= 50 && t >= 18 && t <= 30 && h >= 70) {
    disaster_type = 'landslide';
    risk_score = Math.min(90, 45 + (r / 60) * 35);
  } else if (r >= 30 && t >= 15 && t <= 28) {
    disaster_type = 'landslide';
    risk_score = Math.min(75, 35 + (r / 40) * 30);

  // Drought: low rain, high temp (IMD meteorological drought)
  } else if (r < 10 && t >= 34) {
    disaster_type = 'drought';
    risk_score = Math.min(88, 50 + (10 - r) * 2 + (t - 30) * 1.5);
  } else if (r < 15 && t >= 32) {
    disaster_type = 'drought';
    risk_score = Math.min(75, 40 + (15 - r) * 1.5);

  // Moderate flood / cyclone / fire
  } else if (r >= 25) {
    disaster_type = 'flood';
    risk_score = Math.min(65, 30 + r * 1.2);
  } else if (w >= 40) {
    disaster_type = 'cyclone';
    risk_score = Math.min(65, 35 + (w - 30) * 0.7);
  }

  risk_score = Math.round(Math.max(0, Math.min(100, risk_score)) * 100) / 100;
  return { risk_score, disaster_type: disaster_type === 'none' ? 'other' : disaster_type };
}

/**
 * Get prediction from AI service or fallback.
 * @returns {Promise<{ risk_score: number, disaster_type: string }>}
 */
export async function getPrediction(rainfall, temperature, windSpeed, humidity) {
  const url = process.env.AI_SERVICE_URL;
  const payload = {
    rainfall: rainfall ?? 0,
    temperature: temperature ?? 25,
    wind_speed: windSpeed ?? 0,
    humidity: humidity ?? 50,
    history: []
  };

  if (url && url.startsWith('http')) {
    try {
      const response = await axios.post(`${url}/predict`, payload, {
        timeout: 10000,
        validateStatus: () => true
      });
      if (response.status === 200 && response.data) {
        const { risk_score, disaster_type } = response.data;
        return {
          risk_score: Number(risk_score) || 0,
          disaster_type: disaster_type && disaster_type !== 'none' ? String(disaster_type) : 'other'
        };
      }
    } catch (err) {
      console.warn('AI service unavailable, using fallback:', err.message);
    }
  }

  return fallbackPredict(payload.rainfall, payload.temperature, payload.wind_speed, payload.humidity);
}
