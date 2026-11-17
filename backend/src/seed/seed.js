import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import Species from '../models/Species.js';
import Plant from '../models/Plant.js';
import Article from '../models/Article.js';
import Disease from '../models/Disease.js';
import User from '../models/User.js';
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
    Species.deleteMany(),
    Plant.deleteMany(),
    Article.deleteMany(),
    Disease.deleteMany(),
  ]);

  const withSlug = (arr, field) =>
    arr.map((x) => ({ ...x, slug: `${slugify(x[field])}-${Math.random().toString(36).slice(2, 7)}` }));

  await Species.insertMany(withSlug(species, 'commonName'));
  await Plant.insertMany(withSlug(plants, 'name'));
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

  console.log('✅ Seed dữ liệu hoàn tất!');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
