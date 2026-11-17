# 🐠 AquaVerse

Web quản lý cá cảnh & kiến thức thủy sinh — xây bằng **MERN** (MongoDB, Express, React, Node).

- Phần **kiến thức** (loài cá, cây thủy sinh, bài viết, công cụ) public — ai cũng xem được.
- Phần **quản lý hồ cá** cần đăng nhập (theo dõi thông số nước, lịch chăm sóc, cảnh báo).

## Cấu trúc

```
Aquarium/
├── backend/          API Express + Mongoose
│   ├── server.js
│   └── src/
│       ├── app.js            cấu hình Express, mount routes
│       ├── config/db.js      kết nối MongoDB
│       ├── models/           User, Tank, Livestock, WaterLog, CareTask,
│       │                     Species, Plant, Article, Disease...
│       ├── controllers/      authController, tankController, crudFactory
│       ├── routes/           auth, tanks, species, plants, articles, diseases
│       ├── middleware/       auth (JWT + role), errorHandler
│       ├── utils/            token, slugify
│       └── seed/seed.js      dữ liệu mẫu + tài khoản admin
└── frontend/         React + Vite + Tailwind
    └── src/
        ├── api/client.js     axios + gắn token
        ├── context/AuthContext.jsx
        ├── components/        Layout, Navbar, ProtectedRoute
        └── pages/            Home, Species, Plants, Articles, Tools,
                              Login, Register, MyTanks, TankDetail
```

## Chạy dự án

### 1. Yêu cầu
- Node.js 18+
- MongoDB (local `mongodb://127.0.0.1:27017` hoặc MongoDB Atlas)

### 2. Backend
```bash
cd backend
cp .env.example .env        # rồi sửa MONGO_URI, JWT_SECRET
npm install
npm run seed                # (tùy chọn) nạp dữ liệu mẫu
npm run dev                 # chạy tại http://localhost:5000
```

Tài khoản admin mẫu sau khi seed: `admin@aquaverse.app` / `admin123`

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # chạy tại http://localhost:5173
```

Vite đã proxy `/api` sang `http://localhost:5000` nên không cần cấu hình thêm.

## API chính

| Method | Endpoint | Mô tả | Quyền |
|--------|----------|-------|-------|
| POST | `/api/auth/register` | Đăng ký | Public |
| POST | `/api/auth/login` | Đăng nhập | Public |
| GET | `/api/auth/me` | Thông tin user | Member |
| GET/POST | `/api/tanks` | Danh sách / tạo hồ | Member |
| GET/PUT/DELETE | `/api/tanks/:id` | Chi tiết hồ | Member (chủ hồ) |
| POST | `/api/tanks/:id/water-logs` | Ghi thông số nước | Member |
| POST | `/api/tanks/:id/care-tasks` | Thêm lịch chăm sóc | Member |
| GET | `/api/species` `/api/plants` `/api/articles` `/api/diseases` | Thư viện (lọc, tìm, phân trang) | Public |
| POST/PUT/DELETE | các route thư viện | Thêm/sửa/xóa | Editor / Admin |

## Roadmap
- **P1 (MVP)** ✅ Thư viện public, Auth, quản lý hồ, water log + biểu đồ, công cụ.
- **P2** Thông báo nhắc lịch, compatibility checker, admin panel UI.
- **P3** Cộng đồng (chia sẻ hồ, comment), PWA mobile.
