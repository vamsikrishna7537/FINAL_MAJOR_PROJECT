import mongoose from 'mongoose';

const disasterSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['flood', 'earthquake', 'cyclone', 'fire', 'landslide', 'tsunami', 'drought', 'other']
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  locationName: {
    type: String,
    default: ''
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'monitoring'],
    default: 'active'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  predictedBy: {
    type: String,
    default: 'AI'
  },
  details: {
    rainfall: Number,
    temperature: Number,
    windSpeed: Number,
    humidity: Number
  }
});

export default mongoose.model('Disaster', disasterSchema);
