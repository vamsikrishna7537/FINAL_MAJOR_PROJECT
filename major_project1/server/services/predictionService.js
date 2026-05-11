import Disaster from '../models/Disaster.js';
import { getPrediction } from './predictionHelper.js';
import { getRealWeather } from './weatherService.js';

const sampleLocations = [
  { lat: 28.6139, lng: 77.2090, name: 'Delhi' },
  { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
  { lat: 12.9716, lng: 77.5946, name: 'Bangalore' },
  { lat: 22.5726, lng: 88.3639, name: 'Kolkata' },
  { lat: 13.0827, lng: 80.2707, name: 'Chennai' },
  { lat: 17.385, lng: 78.4867, name: 'Hyderabad' }
];

export const schedulePrediction = (io) => {
  const runPrediction = async () => {
    try {
      const location = sampleLocations[Math.floor(Math.random() * sampleLocations.length)];
      // Use real weather data from Open-Meteo (national weather services)
      const weatherData = await getRealWeather(location.lat, location.lng);

      const { risk_score, disaster_type } = await getPrediction(
        weatherData.rainfall,
        weatherData.temperature,
        weatherData.windSpeed,
        weatherData.humidity
      );

      if (risk_score > 30) {
        const disaster = new Disaster({
          type: disaster_type,
          riskScore: risk_score,
          latitude: location.lat,
          longitude: location.lng,
          locationName: location.name,
          details: {
            rainfall: weatherData.rainfall,
            temperature: weatherData.temperature,
            windSpeed: weatherData.windSpeed,
            humidity: weatherData.humidity
          }
        });

        await disaster.save();
        io.emit('disaster-update', disaster);
        console.log(`New prediction: ${disaster_type} at ${location.name} (Risk: ${risk_score})`);
        // Auto-alert: if enabled and risk >= minRisk, send alert + SMS
        const { tryAutoAlert } = await import('./autoAlertService.js');
        const autoResult = await tryAutoAlert(disaster.toObject(), io);
        if (autoResult.sent) {
          console.log(`[Auto-Alert] Sent for ${location.name} (Risk: ${risk_score})`);
        }
      }
    } catch (error) {
      console.error('Scheduled prediction error:', error.message);
    }
  };

  runPrediction();
  setInterval(runPrediction, 5 * 60 * 1000);
  console.log('Prediction service scheduled (AI or fallback)');
};
