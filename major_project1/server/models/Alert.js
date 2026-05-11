import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['disaster', 'evacuation', 'safety', 'weather']
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  location: {
    latitude: Number,
    longitude: Number,
    radius: Number // in km
  },
  usersNotified: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Alert', alertSchema);
