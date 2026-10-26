import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Product from './models/Product.js';
import Order from './models/Order.js';

const products = [
  { name: 'SkyHawk Pro 4K', brand: 'AeroVista', category: 'Camera Drones', price: 899, countInStock: 15, rating: 4.7, numReviews: 0,
    description: 'Foldable 4K camera drone with 3-axis gimbal, obstacle avoidance and 34 minutes of flight time.',
    specs: { flightTime: '34 min', range: '10 km', camera: '4K / 60fps', weight: '249 g' } },
  { name: 'Phantom Elite 6K', brand: 'AeroVista', category: 'Camera Drones', price: 1599, countInStock: 8, rating: 4.9, numReviews: 0,
    description: 'Flagship 6K cinema drone with 1-inch sensor, omnidirectional sensing and 45 minute flight time.',
    specs: { flightTime: '45 min', range: '15 km', camera: '6K / 30fps', weight: '895 g' } },
  { name: 'Nimbus Mini 2', brand: 'Cloudline', category: 'Camera Drones', price: 449, countInStock: 25, rating: 4.4, numReviews: 0,
    description: 'Sub-250g beginner-friendly drone with 2.7K camera, GPS return-to-home and intelligent shots.',
    specs: { flightTime: '31 min', range: '6 km', camera: '2.7K / 30fps', weight: '199 g' } },
  { name: 'Viper FPV Racer X', brand: 'Velocity', category: 'Racing Drones', price: 379, countInStock: 20, rating: 4.6, numReviews: 0,
    description: '5-inch freestyle racing quad with carbon frame, 6S ready and digital FPV system.',
    specs: { flightTime: '6 min', range: '2 km', camera: '1080p FPV', weight: '520 g' } },
  { name: 'Bolt 3 Whoop', brand: 'Velocity', category: 'Racing Drones', price: 159, countInStock: 40, rating: 4.2, numReviews: 0,
    description: 'Tiny, durable indoor whoop with ducted props. Perfect for learning FPV safely.',
    specs: { flightTime: '5 min', range: '300 m', camera: '720p FPV', weight: '35 g' } },
  { name: 'Sparrow Kids Drone', brand: 'Cloudline', category: 'Toy Drones', price: 49, countInStock: 60, rating: 4.1, numReviews: 0,
    description: 'Prop-guarded toy drone with altitude hold, one-key takeoff and LED lights.',
    specs: { flightTime: '10 min', range: '50 m', camera: 'None', weight: '60 g' } },
  { name: 'Orbit Selfie Flyer', brand: 'Cloudline', category: 'Toy Drones', price: 89, countInStock: 35, rating: 4.0, numReviews: 0,
    description: 'Pocket-sized foldable selfie drone with 1080p camera and phone control.',
    specs: { flightTime: '12 min', range: '100 m', camera: '1080p', weight: '95 g' } },
  { name: 'AgriMax Sprayer 10L', brand: 'TerraFly', category: 'Industrial Drones', price: 4999, countInStock: 4, rating: 4.8, numReviews: 0,
    description: 'Agricultural spraying drone with 10L tank, RTK positioning and autonomous mission planning.',
    specs: { flightTime: '20 min', range: '5 km', camera: 'FPV nav cam', weight: '11 kg' } },
  { name: 'SurveyPro Mapper', brand: 'TerraFly', category: 'Industrial Drones', price: 3299, countInStock: 6, rating: 4.7, numReviews: 0,
    description: 'Photogrammetry drone with mechanical shutter 20MP camera for mapping and inspection.',
    specs: { flightTime: '40 min', range: '8 km', camera: '20MP mech shutter', weight: '1.4 kg' } },
  { name: 'Intelligent Flight Battery', brand: 'AeroVista', category: 'Accessories', price: 129, countInStock: 50, rating: 4.5, numReviews: 0,
    description: 'Replacement LiPo battery compatible with SkyHawk and Phantom series.',
    specs: { flightTime: '+34 min', range: '-', camera: '-', weight: '295 g' } },
  { name: 'ND Filter Set (4pc)', brand: 'Cloudline', category: 'Accessories', price: 59, countInStock: 70, rating: 4.3, numReviews: 0,
    description: 'ND8/16/32/64 filters for smoother cinematic footage.',
    specs: { flightTime: '-', range: '-', camera: '-', weight: '20 g' } },
  { name: 'Hard Shell Carry Case', brand: 'Velocity', category: 'Accessories', price: 79, countInStock: 45, rating: 4.6, numReviews: 0,
    description: 'Waterproof protective case with custom foam fit for most 5-inch and foldable drones.',
    specs: { flightTime: '-', range: '-', camera: '-', weight: '780 g' } },
];

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/droneshop');
await Promise.all([Order.deleteMany(), Product.deleteMany(), User.deleteMany()]);

await User.create([
  { name: 'Admin', email: 'admin@droneshop.com', password: 'admin123', isAdmin: true },
  { name: 'Demo Customer', email: 'user@droneshop.com', password: 'user123' },
]);
await Product.insertMany(products);

console.log('Seeded: 2 users, %d products', products.length);
console.log('Admin: admin@droneshop.com / admin123');
console.log('User:  user@droneshop.com / user123');
await mongoose.disconnect();
