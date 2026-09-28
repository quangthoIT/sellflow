# Product Requirements Document (PRD) - SellFlow System

## 1. Executive Summary
Hệ thống Quản lý Bán hàng SellFlow (SellFlow System) là nền tảng quản lý toàn diện quy trình bán hàng cho các doanh nghiệp vừa và nhỏ, bao gồm quản lý sản phẩm, tồn kho, khách hàng, báo giá, hợp đồng, thanh toán, mẫu tài liệu và gửi email tự động.

---

## 2. System Architecture & Component Diagram

```
[ Frontend (Next.js 14+) ] 
           │
           ▼ (HTTP/REST API)
[ Backend API (Fastify + TypeScript) ] ────► [ Storage (Local / S3) ]
           │                                    (PDF, DOCX, Templates)
           ├─────────────────────────┐
           ▼                         ▼
 [ PostgreSQL Database ]     [ Redis Message Queue ]
 (Prisma ORM)                        │
                                     ▼
                        [ Worker (Node.js Service) ]
                        ├── PDF Generator (Puppeteer/HTML)
                        └── Email Sender (Nodemailer/SMTP)
```

---

## 3. Core Modules & Business Capabilities

### 3.1 Authentication & User Management (`/modules/auth`, `/modules/users`)
- Đăng nhập, đăng xuất, JWT token rotation.
- Phân quyền người dùng (Admin, Sales Representative, Accountant).

### 3.2 Product Catalog (`/modules/products`)
- Quản lý danh mục sản phẩm/dịch vụ, đơn vị tính, giá vốn, giá bán.
- Theo dõi ngưỡng cảnh báo tồn kho tối thiểu (`min_stock`).

### 3.3 Inventory Management (`/modules/inventory`)
- Nhật ký xuất/nhập/điều chỉnh/hoàn trả kho (`inventory_transactions`).
- Tự động trừ tồn kho khi ký/duyệt Hợp đồng (`stock_applied = true`).

### 3.4 Customer Directory (`/modules/customers`)
- Lưu trữ thông tin đối tác: Tên doanh nghiệp/cá nhân, MST, Email, Điện thoại, Địa chỉ, Người đại diện.
- Lịch sử báo giá, hợp đồng, thanh toán theo từng khách hàng.

### 3.5 Quotations (`/modules/quotations`)
- Lập Báo giá với danh sách hàng hóa (`quote_items`), chiết khấu, thuế VAT, phí vận chuyển.
- Chuyển trạng thái: Nháp -> Đã gửi -> Đã chấp nhận -> Đã từ chối -> Đã hủy.
- Tính năng 1-Click chuyển đổi Báo giá thành Hợp đồng.
- Xuất PDF Báo giá từ Template HTML.

### 3.6 Contracts (`/modules/contracts`)
- Quản lý Hợp đồng kinh tế (`contract_items`), liên kết Báo giá gốc.
- Quản lý giá trị hợp đồng, theo dõi tiến độ thanh toán và tồn kho.
- Xuất Hợp đồng ra PDF / DOCX.

### 3.7 Payments & Cashflow (`/modules/payments`)
- Đợt thanh toán theo Hợp đồng.
- Cập nhật số tiền đã thu, dư nợ còn lại của Hợp đồng.

### 3.8 Document Templates (`/modules/templates`)
- Trình biên tập mẫu báo giá và hợp đồng HTML.
- Hỗ trợ các biến động: `{{TEN_KHACH_HANG}}`, `{{MA_BAO_GIA}}`, `{{TONG_TIEN}}`, `{{DANH_SACH_SAN_PHAM}}`.

### 3.9 Async Worker & Emails (`/modules/emails`, `/modules/documents`, Worker)
- Queue gửi Email thông báo/báo giá/hợp đồng đính kèm file PDF.
- Lưu nhật ký gửi email (`email_logs`).

---

## 4. Non-Functional Requirements
- **Hiệu năng:** API response < 100ms cho các truy vấn dữ liệu chuẩn.
- **Tốc độ xử lý Job:** Sinh PDF < 2s/tài liệu thông qua Worker tách biệt.
- **Bảo mật:** Mã hóa mật khẩu bcrypt/argon2, Validate dữ liệu đầu vào bằng Zod schema.
