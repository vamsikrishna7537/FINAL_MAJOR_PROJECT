import mongoose from 'mongoose';

const alertSubscriberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  areaName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('AlertSubscriber', alertSubscriberSchema);
