import { pathToFileURL } from 'node:url';
import { catalogSpecies, catalogPlants } from './catalogData.js';
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

export const species = [...catalogSpecies,
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
];
export const plants = catalogPlants;

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

// Model injection keeps the keyed upsert contract testable without MongoDB.
export async function seedCatalog(SpeciesModel = Species, PlantModel = Plant) {
  const savedSpecies = await Promise.all(species.map((item) => SpeciesModel.findOneAndUpdate(
    item.speciesKey ? { speciesKey: item.speciesKey } : { sciName: item.sciName, speciesKey: { $exists: false } },
    { $set: item, $setOnInsert: { slug: item.speciesKey || slugify(item.commonName) } },
    { upsert: true, new: true, runValidators: true },
  )));
  const savedPlants = await Promise.all(plants.map((item) => PlantModel.findOneAndUpdate(
    { plantKey: item.plantKey }, { $set: item, $setOnInsert: { slug: item.plantKey } },
    { upsert: true, new: true, runValidators: true },
  )));
  return { savedSpecies, savedPlants };
}

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
  const { savedSpecies, savedPlants } = await seedCatalog();
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

if (typeof process !== 'undefined' && process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch((err) => {
  console.error(err);
  process.exit(1);
});
