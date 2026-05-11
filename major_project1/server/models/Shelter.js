import mongoose from 'mongoose';

const shelterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['shelter', 'hospital'],
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  capacity: {
    type: Number,
    default: 0
  },
  currentOccupancy: {
    type: Number,
    default: 0
  },
  address: String,
  phone: String,
  facilities: [String]
});

export default mongoose.model('Shelter', shelterSchema);
