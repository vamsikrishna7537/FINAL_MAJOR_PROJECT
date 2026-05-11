import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Shelter from '../models/Shelter.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-db');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Shelter.deleteMany({});

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({
      name: 'Admin User',
      email: 'admin@disaster.com',
      password: adminPassword,
      role: 'admin',
      phone: '+1234567890'
    });
    await admin.save();
    console.log('Admin user created:', admin.email);

    // Create regular user
    const userPassword = await bcrypt.hash('user123', 10);
    const user = new User({
      name: 'Test User',
      email: 'user@test.com',
      password: userPassword,
      role: 'user',
      phone: '+1234567891'
    });
    await user.save();
    console.log('Test user created:', user.email);

    // Create shelters and hospitals
    const shelters = [
      {
        name: 'Delhi Emergency Shelter',
        type: 'shelter',
        latitude: 28.6139,
        longitude: 77.2090,
        capacity: 500,
        address: 'New Delhi, India',
        phone: '+911234567890'
      },
      {
        name: 'Mumbai Relief Center',
        type: 'shelter',
        latitude: 19.0760,
        longitude: 72.8777,
        capacity: 300,
        address: 'Mumbai, India',
        phone: '+911234567891'
      },
      {
        name: 'Bangalore Safe Zone',
        type: 'shelter',
        latitude: 12.9716,
        longitude: 77.5946,
        capacity: 400,
        address: 'Bangalore, India',
        phone: '+911234567892'
      },
      {
        name: 'AIIMS Hospital',
        type: 'hospital',
        latitude: 28.5673,
        longitude: 77.2090,
        capacity: 1000,
        address: 'New Delhi, India',
        phone: '+911234567893',
        facilities: ['Emergency', 'ICU', 'Surgery']
      },
      {
        name: 'Apollo Hospital',
        type: 'hospital',
        latitude: 19.1364,
        longitude: 72.8297,
        capacity: 800,
        address: 'Mumbai, India',
        phone: '+911234567894',
        facilities: ['Emergency', 'ICU', 'Surgery', 'Trauma']
      },
      {
        name: 'Fortis Hospital',
        type: 'hospital',
        latitude: 12.9352,
        longitude: 77.6245,
        capacity: 600,
        address: 'Bangalore, India',
        phone: '+911234567895',
        facilities: ['Emergency', 'ICU']
      }
    ];

    for (const shelter of shelters) {
      await Shelter.create(shelter);
    }
    console.log(`${shelters.length} shelters/hospitals created`);

    console.log('Seed data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
