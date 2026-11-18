import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import Species from '../models/Species.js';
import Plant from '../models/Plant.js';
import Article from '../models/Article.js';
import Disease from '../models/Disease.js';
import User from '../models/User.js';
import Tank from '../models/Tank.js';
import Livestock from '../models/Livestock.js';
import TankPlant from '../models/TankPlant.js';
import Hardscape from '../models/Hardscape.js';
import { slugify } from '../utils/token.js';

dotenv.config();

const species = [
  {
    commonName: 'Cá Betta (Cá xiêm)',
    sciName: 'Betta splendens',
    category: 'fish',
    difficulty: 'easy',
    careLevel: 'low',
    minTankSize: 20,
    adultSize: 7,
    tempRange: { min: 24, max: 28 },
    phRange: { min: 6.5, max: 7.5 },
    temperament: 'aggressive',
    diet: 'carnivore',
    description:
      'Cá cảnh phổ biến nhờ màu sắc rực rỡ và vây dài. Cá đực rất hiếu chiến, không nuôi chung hai con đực trong cùng một hồ.',
    tags: ['phổ biến', 'dễ nuôi', 'hồ nhỏ'],
  },
  {
    commonName: 'Cá Neon',
    sciName: 'Paracheirodon innesi',
    category: 'fish',
    difficulty: 'easy',
    careLevel: 'low',
    minTankSize: 40,
    adultSize: 3,
    tempRange: { min: 22, max: 26 },
    phRange: { min: 6.0, max: 7.0 },
    temperament: 'peaceful',
    diet: 'omnivore',
    description: 'Cá đàn lấp lánh, nên nuôi theo đàn từ 8 con trở lên.',
    tags: ['cá đàn', 'hiền'],
  },
  {
    commonName: 'Tép Red Cherry',
    sciName: 'Neocaridina davidi',
    category: 'shrimp',
    difficulty: 'easy',
    careLevel: 'low',
    minTankSize: 20,
    adultSize: 2,
    tempRange: { min: 20, max: 28 },
    phRange: { min: 6.5, max: 8.0 },
    temperament: 'peaceful',
    diet: 'omnivore',
    description: 'Tép đỏ dễ nuôi, dọn rêu tốt, nhạy cảm với nồng độ NO3 cao.',
    tags: ['dọn rêu', 'tép'],
  },
  {
    commonName: 'Otocinclus',
    sciName: 'Otocinclus vittatus',
    category: 'fish',
    difficulty: 'medium',
    careLevel: 'medium',
    minTankSize: 40,
    adultSize: 4,
    tempRange: { min: 22, max: 27 },
    phRange: { min: 6.0, max: 7.5 },
    temperament: 'peaceful',
    diet: 'herbivore',
    description: 'Cá lau kính nhỏ, ăn rêu xanh, cần hồ đã ổn định vi sinh.',
    tags: ['dọn rêu', 'cá đàn'],
  },
];

const plants = [
  {
    name: 'Trân châu Cuba',
    sciName: 'Hemianthus callitrichoides',
    light: 'high',
    co2: 'required',
    growthRate: 'medium',
    difficulty: 'hard',
    position: 'foreground',
    description: 'Cây tiền cảnh tạo thảm xanh, cần CO2 và ánh sáng mạnh.',
    tags: ['tiền cảnh', 'thảm'],
  },
  {
    name: 'Ráy Anubias',
    sciName: 'Anubias barteri',
    light: 'low',
    co2: 'not_needed',
    growthRate: 'slow',
    difficulty: 'easy',
    position: 'midground',
    description: 'Cây buộc lũa/đá cực dễ, không cần CO2, hợp người mới.',
    tags: ['dễ nuôi', 'buộc lũa'],
  },
  {
    name: 'Rong đuôi chồn',
    sciName: 'Ceratophyllum demersum',
    light: 'medium',
    co2: 'not_needed',
    growthRate: 'fast',
    difficulty: 'easy',
    position: 'background',
    description: 'Cây thả trôi/cắm nền lớn nhanh, hút dinh dưỡng thừa tốt.',
    tags: ['lớn nhanh', 'hút độc'],
  },
];

// Phase 1: enrich existing entries rather than duplicating Betta/Neon or plants.
Object.assign(species[0], { speciesKey: 'betta', render: { spriteKey: 'betta', canvas: 64, bodyPx: 50,
  swimZone: ['top', 'mid'], behavior: 'wander', speed: 0.6 } });
Object.assign(species[1], { speciesKey: 'neon_tetra', render: { spriteKey: 'neon_tetra', canvas: 64, bodyPx: 38,
  swimZone: ['mid'], behavior: 'school', schoolMin: 6, speed: 1 } });
species.push(
  { speciesKey: 'angelfish', commonName: 'Thần tiên', sciName: 'Pterophyllum scalare', adultSize: 15,
    minTankSize: 120, tempRange: { min: 24, max: 30 }, phRange: { min: 6, max: 7.5 },
    render: { spriteKey: 'angelfish', canvas: 64, bodyPx: 34, swimZone: ['mid'], behavior: 'hover', speed: 0.7 } },
  { speciesKey: 'guppy', commonName: 'Bảy màu', sciName: 'Poecilia reticulata', adultSize: 5,
    minTankSize: 40, tempRange: { min: 22, max: 28 }, phRange: { min: 6.5, max: 8 },
    render: { spriteKey: 'guppy', canvas: 64, bodyPx: 36, swimZone: ['top', 'mid'], behavior: 'wander', speed: 1.1 } },
  { speciesKey: 'panda_cory', commonName: 'Chuột Panda', sciName: 'Corydoras panda', adultSize: 5,
    minTankSize: 60, tempRange: { min: 20, max: 26 }, phRange: { min: 6, max: 7.5 },
    render: { spriteKey: 'panda_cory', canvas: 64, bodyPx: 34, swimZone: ['bottom'], behavior: 'forage', schoolMin: 6, speed: 0.8 } },
);
Object.assign(plants[0], { plantKey: 'carpet_grass', render: { spriteKey: 'carpet_grass', heightPx: 24 } });
Object.assign(plants[1], { plantKey: 'anubias', render: { spriteKey: 'anubias', heightPx: 48 } });
plants.push(
  { plantKey: 'java_fern', name: 'Dương xỉ Java', sciName: 'Microsorum pteropus', position: 'midground',
    render: { spriteKey: 'java_fern', heightPx: 80 } },
  { plantKey: 'rotala', name: 'Rotala', sciName: 'Rotala rotundifolia', position: 'background',
    render: { spriteKey: 'rotala', heightPx: 120 } },
  { plantKey: 'vallisneria', name: 'Cỏ hẹ', sciName: 'Vallisneria spiralis', position: 'background',
    render: { spriteKey: 'vallisneria', heightPx: 160 } },
  { plantKey: 'moss', name: 'Rêu Java', sciName: 'Taxiphyllum barbieri', position: 'midground',
    render: { spriteKey: 'moss', heightPx: 32 } },
);

const articles = [
  {
    title: 'Hướng dẫn cân bằng vi sinh (cycle) cho hồ mới',
    excerpt:
      'Quy trình cycle giúp hồ tạo đủ vi sinh xử lý chất thải trước khi thả cá.',
    content:
      'Chu trình nitơ là nền tảng của một hồ khỏe mạnh. Bài viết hướng dẫn từng bước...',
    category: 'setup',
    status: 'published',
    publishedAt: new Date(),
    tags: ['hồ mới', 'vi sinh'],
  },
  {
    title: 'Cách trị rêu hại thường gặp trong hồ thủy sinh',
    excerpt: 'Nhận diện và xử lý rêu tóc, rêu chùm đen, rêu nhớt xanh.',
    content: 'Rêu hại là nỗi ám ảnh của người chơi thủy sinh...',
    category: 'maintenance',
    status: 'published',
    publishedAt: new Date(),
    tags: ['rêu hại', 'bảo trì'],
  },
];

const diseases = [
  {
    name: 'Bệnh đốm trắng (Ich)',
    symptoms: ['Đốm trắng li ti trên thân và vây', 'Cá cọ mình vào vật cứng'],
    causes: ['Ký sinh trùng Ichthyophthirius', 'Sốc nhiệt, nước bẩn'],
    treatment: 'Tăng nhiệt độ từ từ lên 30°C, dùng thuốc đặc trị, thay nước đều.',
    prevention: 'Cách ly cá mới 1-2 tuần, giữ nhiệt độ ổn định.',
  },
];

const run = async () => {
  await connectDB();
  console.log('🌱 Đang xóa dữ liệu cũ...');
  await Promise.all([
    Article.deleteMany(),
    Disease.deleteMany(),
  ]);

  const withSlug = (arr, field) =>
    arr.map((x) => ({ ...x, slug: `${slugify(x[field])}-${Math.random().toString(36).slice(2, 7)}` }));

  // Keep IDs stable so existing tanks retain their library references on reseed.
  const savedSpecies = await Promise.all(species.map((item) => Species.findOneAndUpdate(
    { sciName: item.sciName }, { $set: item, $setOnInsert: { slug: slugify(item.commonName) } },
    { upsert: true, new: true, runValidators: true },
  )));
  const savedPlants = await Promise.all(plants.map((item) => Plant.findOneAndUpdate(
    { sciName: item.sciName }, { $set: item, $setOnInsert: { slug: slugify(item.name) } },
    { upsert: true, new: true, runValidators: true },
  )));
  await Article.insertMany(withSlug(articles, 'title'));
  await Disease.insertMany(withSlug(diseases, 'name'));

  // Tài khoản admin mẫu
  const adminEmail = 'admin@aquaverse.app';
  if (!(await User.findOne({ email: adminEmail }))) {
    await User.create({
      name: 'Admin',
      email: adminEmail,
      password: 'admin123',
      role: 'admin',
    });
    console.log(`👤 Đã tạo admin: ${adminEmail} / admin123`);
  }

  const admin = await User.findOne({ email: adminEmail });
  const tank = await Tank.findOneAndUpdate(
    { userId: admin._id, note: 'seed:sample_scene_nature' },
    { $set: { name: 'Bể phòng khách', style: 'nature', shape: 'rect', type: 'planted',
      dimensions: { length: 60, width: 30, height: 36 }, volume: 65,
      equipment: ['filter', 'light', 'co2'].map((type) => ({ type, name: type })),
      lightSchedule: { on: '08:00', off: '18:00' }, scene: { props: [], camera: { x: 0 } } } },
    { upsert: true, new: true, runValidators: true },
  );
  await Promise.all([Livestock.deleteMany({ tankId: tank._id }), TankPlant.deleteMany({ tankId: tank._id }),
    Hardscape.deleteMany({ tankId: tank._id })]);
  await Livestock.insertMany(Object.entries({ neon_tetra: 12, betta: 1, angelfish: 2, guppy: 8, panda_cory: 6 })
    .map(([key, quantity]) => {
      const fish = savedSpecies.find((item) => item.speciesKey === key);
      return { tankId: tank._id, speciesId: fish._id, name: fish.commonName, quantity };
    }));
  await TankPlant.insertMany(Object.entries({ vallisneria: 3, rotala: 2, java_fern: 2, anubias: 2, moss: 2, carpet_grass: 6 })
    .map(([key, quantity]) => {
      const plant = savedPlants.find((item) => item.plantKey === key);
      return { tankId: tank._id, plantId: plant._id, name: plant.name, position: plant.position, quantity };
    }));
  await Hardscape.insertMany([
    { type: 'rock', spriteKey: 'seiryu_l', name: 'Đá Seiryu lớn', quantity: 1 },
    { type: 'rock', spriteKey: 'seiryu_m', name: 'Đá Seiryu vừa', quantity: 1 },
    { type: 'rock', spriteKey: 'seiryu_s', name: 'Đá Seiryu nhỏ', quantity: 2 },
    { type: 'driftwood', spriteKey: 'driftwood_branch', name: 'Lũa nhánh', quantity: 1 },
  ].map((item) => ({ ...item, tankId: tank._id })));

  console.log('✅ Seed dữ liệu hoàn tất!');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
