# SellFlow System (Hệ thống Bán hàng & Quản lý Kinh doanh)

Hệ thống quản lý bán hàng toàn diện được thiết kế theo kiến trúc Microservices/Monorepo hiện đại, sạch sẽ và dễ mở rộng.

---

## 🏗 Cấu trúc Thư mục Dự án

```text
sellflow/
│
├── frontend/              # Next.js 14+ / 15 + TypeScript (Giao diện người dùng)
│   ├── app/               # App Router chia theo màn hình/nghiệp vụ
│   │   ├── dashboard/     # Màn hình Tổng quan KPI & Doanh thu
│   │   ├── products/      # Màn hình Quản lý Sản phẩm
│   │   ├── inventory/     # Màn hình Quản lý Tồn kho & Nhập xuất kho
│   │   ├── customers/     # Màn hình Quản lý Khách hàng
│   │   ├── quotations/    # Màn hình Quản lý Báo giá
│   │   ├── contracts/     # Màn hình Quản lý Hợp đồng
│   │   ├── payments/      # Màn hình Quản lý Thanh toán & Công nợ
│   │   ├── templates/     # Màn hình Quản lý Mẫu in/Template
│   │   ├── emails/        # Màn hình Cấu hình & Lịch sử Email
│   │   └── settings/      # Màn hình Cấu hình Hệ thống
│   ├── components/        # Thư viện UI Components tái sử dụng
│   ├── features/          # Logic nghiệp vụ nâng cao theo feature
│   ├── lib/               # Utility helper, HTTP client, Formatters
│   └── public/            # Hình ảnh và Static Assets
│
├── backend/               # Node.js + TypeScript + Fastify REST API
│   ├── src/
│   │   ├── modules/       # Các module nghiệp vụ chính (Auth, Products, Quotes...)
│   │   ├── services/      # Các shared service (Storage, PDF Engine, Mailer)
│   │   ├── routes/        # Router tổng điều hướng các API endpoints
│   │   ├── config/        # Environment variables & DB/Redis Client
│   │   └── server.ts      # Fastify App bootstrap entrypoint
│   └── prisma/            # PostgreSQL Database ORM schema & seeds
│       ├── schema.prisma  # Schema định nghĩa bảng dữ liệu
│       ├── migrations/    # Lịch sử Migration DB
│       └── seed.ts        # Dữ liệu mẫu khởi tạo ban đầu
│
├── worker/                # Worker Service (Xử lý PDF, Email & Background Job)
│   └── src/
│       ├── pdf.ts         # Khối xử lý Render HTML ra file PDF
│       ├── email.ts       # Khối xử lý Gửi Email qua SMTP
│       └── worker.ts      # Engine lắng nghe Redis Queue (BullMQ)
│
├── storage/               # Lưu trữ file local khi phát triển (Dev Environment)
│   ├── templates/         # Thư mục chứa các mẫu in DOCX/HTML
│   ├── contracts/         # File PDF Hợp đồng xuất ra
│   └── quotations/        # File PDF Báo giá xuất ra
│
├── docs/                  # Tài liệu chi tiết của dự án
│   ├── PRD.md             # Document Mô tả Yêu cầu Sản phẩm (PRD)
│   └── DATABASE.md        # Document Chi tiết Cơ sở dữ liệu & ERD
│
├── docker-compose.yml     # Orchestration cho PostgreSQL, Redis, Backend, Worker, Frontend
├── .env                   # Biến môi trường thực thi local
├── .env.example           # Biến môi trường mẫu
└── README.md              # Tài liệu hướng dẫn sử dụng này
```

---

## 🚀 Hướng dẫn Chạy Dự án (Quick Start)

### 1. Yêu cầu Tiền đề (Prerequisites)
- **Node.js**: `v18.x` hoặc `v20.x` trở lên.
- **Docker & Docker Compose** (nếu chạy qua Docker Container).
- **PostgreSQL & Redis** (nếu chạy trực tiếp ở máy local).

### 2. Khởi chạy bằng Docker Compose (Khuyên dùng)
```bash
cd sellflow
docker-compose up -d --build
```
Dịch vụ sẽ khởi tạo tại:
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000/api`
- **PostgreSQL Database**: `localhost:5432`
- **Redis Server**: `localhost:6379`

### 3. Chạy môi trường Development (Chế độ Độc lập)

#### Bước 1: Setup Backend
```bash
cd sellflow/backend
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

#### Bước 2: Setup Worker Service
```bash
cd sellflow/worker
npm install
npm run dev
```

#### Bước 3: Setup Frontend App
```bash
cd sellflow/frontend
npm install
npm run dev
```

---

## ⚡ Luồng Hoạt động Tổng quan (Data & Task Flow)

1. **Frontend Request** ➔ Thực hiện các thao tác quản lý dữ liệu tới **Backend API**.
2. **Backend API** ➔ Xử lý CRUD dữ liệu với **PostgreSQL** qua Prisma ORM.
3. **Async Tasks** ➔ Khi tạo Báo giá/Hợp đồng cần xuất PDF hoặc gửi Email:
   - Backend đẩy công việc (Job) vào **Redis Queue**.
   - **Worker** tiêu thụ công việc ➔ Render PDF ➔ Gửi Email qua SMTP.
   - Lưu trữ File kết quả vào thư mục **Storage**.
