/**
 * Real weather data from Open-Meteo API (free, no API key).
 * Provides accurate rainfall, temperature, humidity, wind for disaster prediction.
 * Data sourced from national weather services (NOAA, ECMWF, DWD, etc.).
 */

import axios from 'axios';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch real weather for a location.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<{ rainfall: number, temperature: number, humidity: number, windSpeed: number }>}
 */
export async function getRealWeather(lat, lng) {
  try {
    const { data } = await axios.get(OPEN_METEO_URL, {
      params: {
        latitude: lat,
        longitude: lng,
        hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',
        forecast_days: 2
      },
      timeout: 8000
    });

    const h = data?.hourly;
    if (!h || !Array.isArray(h.temperature_2m) || h.temperature_2m.length === 0) {
      return getFallbackWeather();
    }

    // Use next 24h averages/peaks for disaster prediction
    const hrs = Math.min(24, h.temperature_2m.length);
    const temps = h.temperature_2m.slice(0, hrs);
    const humidity = h.relative_humidity_2m?.slice(0, hrs) || temps.map(() => 60);
    const precip = h.precipitation?.slice(0, hrs) || temps.map(() => 0);
    const wind = h.wind_speed_10m?.slice(0, hrs) || temps.map(() => 5);

    const temperature = temps.reduce((a, b) => a + b, 0) / temps.length;
    const avgHumidity = humidity.reduce((a, b) => a + b, 0) / humidity.length;
    const rainfall = precip.reduce((a, b) => a + b, 0) * (24 / hrs); // mm per 24h
    const windSpeed = Math.max(...wind);

    return {
      rainfall: Math.round(rainfall * 10) / 10,
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(avgHumidity),
      windSpeed: Math.round(windSpeed * 10) / 10
    };
  } catch (err) {
    console.warn('[Weather] Open-Meteo unavailable, using fallback:', err.message);
    return getFallbackWeather();
  }
}

function getFallbackWeather() {
  return {
    rainfall: 0,
    temperature: 28,
    humidity: 55,
    windSpeed: 8
  };
}
