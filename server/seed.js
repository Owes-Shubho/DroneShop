import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Product from './models/Product.js';
import Order from './models/Order.js';
import Coupon from './models/Coupon.js';

const img = (f) => `/images/drones/${f}.jpg`;

const products = [
  { name: 'DJI Mini 2', brand: 'DJI', category: 'Camera Drones', price: 449, countInStock: 25, rating: 4.5, numReviews: 0, image: img('dji-mini-2'),
    description: 'Sub-250 g beginner-friendly drone with 4K video, 3-axis gimbal, GPS return-to-home and QuickShots modes.',
    specs: { flightTime: '31 min', range: '10 km', camera: '4K / 30fps', weight: '242 g' } },
  { name: 'DJI Mini 4 Pro', brand: 'DJI', category: 'Camera Drones', price: 759, countInStock: 18, rating: 4.8, numReviews: 0, image: img('dji-mini-4-pro'),
    description: 'Pocket-sized pro drone with 4K/100fps video, omnidirectional obstacle sensing, ActiveTrack and true vertical shooting.',
    specs: { flightTime: '34 min', range: '20 km', camera: '4K / 100fps', weight: '< 249 g' } },
  { name: 'DJI Mavic Air 2', brand: 'DJI', category: 'Camera Drones', price: 799, countInStock: 14, rating: 4.6, numReviews: 0, image: img('dji-mavic-air-2'),
    description: 'Foldable drone with 48MP photos, 4K/60 video, ActiveTrack 3.0 and obstacle sensing front, rear and down.',
    specs: { flightTime: '34 min', range: '10 km', camera: '4K / 60fps, 48MP', weight: '570 g' } },
  { name: 'DJI Mavic 3', brand: 'DJI', category: 'Camera Drones', price: 2199, countInStock: 7, rating: 4.8, numReviews: 0, image: img('dji-mavic-3'),
    description: 'Professional aerial imaging with a 4/3-inch Hasselblad camera, up to 5.1K video, dual cameras and omnidirectional sensing.',
    specs: { flightTime: '46 min', range: '15 km', camera: '4/3 CMOS, 5.1K', weight: '895 g' } },
  { name: 'DJI Inspire 2', brand: 'DJI', category: 'Industrial Drones', price: 3299, countInStock: 3, rating: 4.7, numReviews: 0, image: img('dji-inspire-2'),
    description: 'Cinema and broadcast platform with swappable camera heads, dual-operator control and retractable landing gear. Camera sold separately.',
    specs: { flightTime: '27 min', range: '7 km', camera: 'Interchangeable (X5S / X7)', weight: '3.4 kg' } },
  { name: 'DJI Phantom 3 Advanced', brand: 'DJI', category: 'Camera Drones', price: 349, countInStock: 5, rating: 4.1, numReviews: 0, image: img('dji-phantom-3-advanced'),
    description: 'Older-generation Phantom with 1080p/60 video, 3-axis gimbal and GPS plus vision positioning. Discounted older stock.',
    specs: { flightTime: '23 min', range: '2 km', camera: '1080p / 60fps', weight: '1280 g' } },
  { name: 'Parrot Anafi', brand: 'Parrot', category: 'Camera Drones', price: 599, countInStock: 10, rating: 4.3, numReviews: 0, image: img('parrot-anafi'),
    description: 'Foldable 4K HDR drone with a 180° tilting gimbal, 2.8x lossless zoom and USB-C charging.',
    specs: { flightTime: '25 min', range: '4 km', camera: '4K HDR', weight: '320 g' } },
  { name: 'Autel EVO II Pro', brand: 'Autel', category: 'Camera Drones', price: 1795, countInStock: 6, rating: 4.6, numReviews: 0, image: img('autel-evo-ii-pro'),
    description: '1-inch 20MP camera with 6K video, adjustable aperture and 12 obstacle-avoidance sensors in a foldable body.',
    specs: { flightTime: '40 min', range: '9 km', camera: '1" CMOS 20MP, 6K', weight: '1.1 kg' } },
  { name: 'Yuneec Typhoon H', brand: 'Yuneec', category: 'Camera Drones', price: 899, countInStock: 4, rating: 4.2, numReviews: 0, image: img('yuneec-typhoon-h'),
    description: 'Six-rotor drone with a 360° rotating 4K camera and retractable landing gear. Older discontinued line, limited stock.',
    specs: { flightTime: '25 min', range: '1.6 km', camera: '4K', weight: '1.9 kg' } },
  { image: img('racing-drone'), name: 'Viper FPV Racer X', brand: 'Velocity', category: 'Racing Drones', price: 379, countInStock: 20, rating: 4.6, numReviews: 0,
    description: '5-inch freestyle racing quad with carbon frame, 6S ready and digital FPV system.',
    specs: { flightTime: '6 min', range: '2 km', camera: '1080p FPV', weight: '520 g' } },
  { image: img('drl-racer'), name: 'Bolt 3 Whoop', brand: 'Velocity', category: 'Racing Drones', price: 159, countInStock: 40, rating: 4.2, numReviews: 0,
    description: 'Tiny, durable indoor whoop with ducted props. Perfect for learning FPV safely.',
    specs: { flightTime: '5 min', range: '300 m', camera: '720p FPV', weight: '35 g' } },
  { image: img('toy-quadcopter'), name: 'Sparrow Kids Drone', brand: 'Cloudline', category: 'Toy Drones', price: 49, countInStock: 60, rating: 4.1, numReviews: 0,
    description: 'Prop-guarded toy drone with altitude hold, one-key takeoff and LED lights.',
    specs: { flightTime: '10 min', range: '50 m', camera: 'None', weight: '60 g' } },
  { image: img('parrot-anafi'), name: 'Orbit Selfie Flyer', brand: 'Cloudline', category: 'Toy Drones', price: 89, countInStock: 35, rating: 4.0, numReviews: 0,
    description: 'Pocket-sized foldable selfie drone with 1080p camera and phone control.',
    specs: { flightTime: '12 min', range: '100 m', camera: '1080p', weight: '95 g' } },
  { image: img('dji-agras-t50'), name: 'AgriMax Sprayer 10L', brand: 'TerraFly', category: 'Industrial Drones', price: 4999, countInStock: 4, rating: 4.8, numReviews: 0,
    description: 'Agricultural spraying drone with 10L tank, RTK positioning and autonomous mission planning.',
    specs: { flightTime: '20 min', range: '5 km', camera: 'FPV nav cam', weight: '11 kg' } },
  { image: img('dji-mavic-3'), name: 'SurveyPro Mapper', brand: 'TerraFly', category: 'Industrial Drones', price: 3299, countInStock: 6, rating: 4.7, numReviews: 0,
    description: 'Photogrammetry drone with mechanical shutter 20MP camera for mapping and inspection.',
    specs: { flightTime: '40 min', range: '8 km', camera: '20MP mech shutter', weight: '1.4 kg' } },
  { image: img('lipo-battery'), name: 'High-Capacity LiPo Battery', brand: 'Cloudline', category: 'Accessories', price: 129, countInStock: 50, rating: 4.5, numReviews: 0,
    description: 'Replacement 3S LiPo battery for foldable camera drones.',
    specs: { flightTime: '+34 min', range: '-', camera: '-', weight: '295 g' } },
  { image: img('lens-filter-set'), name: 'ND Filter Set (4pc)', brand: 'Cloudline', category: 'Accessories', price: 59, countInStock: 70, rating: 4.3, numReviews: 0,
    description: 'ND8/16/32/64 filters for smoother cinematic footage.',
    specs: { flightTime: '-', range: '-', camera: '-', weight: '20 g' } },
  { image: img('pelican-case'), name: 'Hard Shell Carry Case', brand: 'Velocity', category: 'Accessories', price: 79, countInStock: 45, rating: 4.6, numReviews: 0,
    description: 'Waterproof protective case with custom foam fit for most 5-inch and foldable drones.',
    specs: { flightTime: '-', range: '-', camera: '-', weight: '780 g' } },
];

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/droneshop');
await Promise.all([Order.deleteMany(), Product.deleteMany(), User.deleteMany(), Coupon.deleteMany()]);

await User.create([
  { name: 'Admin', email: 'admin@droneshop.com', password: 'admin123', isAdmin: true },
  { name: 'Demo Customer', email: 'user@droneshop.com', password: 'user123' },
]);
await Product.insertMany(products);
await Coupon.create([
  { code: 'WELCOME10', type: 'percent', value: 10 },
  { code: 'SAVE50', type: 'fixed', value: 50, minSubtotal: 500 },
]);

console.log('Seeded: 2 users, %d products', products.length);
console.log('Coupons: WELCOME10 (10% off), SAVE50 ($50 off over $500)');
console.log('Admin: admin@droneshop.com / admin123');
console.log('User:  user@droneshop.com / user123');
await mongoose.disconnect();
