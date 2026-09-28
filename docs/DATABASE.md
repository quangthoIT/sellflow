# Database Schema Documentation - SellFlow System

## Overview
Cơ sở dữ liệu sử dụng **PostgreSQL 16**, quản lý bởi **Prisma ORM**.

---

## Entity Relationship (ER) Summary

```
+--------------------+            +-------------------+            +---------------------+
|     customers      | 1        * |      quotes       | 1        * |     quote_items     |
|--------------------|<-----------|-------------------|-----------<|---------------------|
| id (PK)            |            | id (PK)           |            | id (PK)             |
| name               |            | customer_id (FK)  |            | quote_id (FK)       |
| email, phone...    |            | date, status...   |            | product_id (FK)     |
+--------------------+            +-------------------+            +---------------------+
          │                                 │
          │ 1                               │ 1 (optional)
          │                                 ▼
          │ *                     +-------------------+            +---------------------+
          ├---------------------->|     contracts     | 1        * |   contract_items    |
          │                       |-------------------|-----------<|---------------------|
          │                       | id (PK)           |            | id (PK)             |
          │                       | quote_id (FK)     |            | contract_id (FK)    |
          │                       | customer_id (FK)  |            | product_id (FK)     |
          │                       +-------------------+            +---------------------+
          │                                 │ 1
          │                                 │
          │                                 ▼ *
          │                       +-------------------+
          │                       |     payments      |
          │                       |-------------------|
          │                       | id (PK)           |
          │                       | contract_id (FK)  |
          │                       | amount, date...   |
          │                       +-------------------+
          ▼ *
+--------------------+
| inventory_trans    |
|--------------------|
| id (PK)            |
| product_id (FK)    |
| type, qty...       |
+--------------------+
```

---

## Detailed Data Tables

### 1. `users`
Bảng quản lý tài khoản người dùng và phân quyền.
- `id`: String (UUID / CUID, Primary Key)
- `email`: String (Unique)
- `password`: String (Hashed)
- `name`: String
- `role`: Enum (`ADMIN`, `SALES`, `ACCOUNTANT`)
- `created_at`: DateTime

### 2. `products`
Bảng sản phẩm & tồn kho.
- `id`: String (Primary Key, e.g. `SP001`)
- `name`: String (Not Null)
- `category`: String
- `unit`: String (Đơn vị tính: cái, bộ, mét...)
- `cost`: BigInt (Giá vốn)
- `price`: BigInt (Giá bán)
- `stock`: Int (Tồn kho hiện tại)
- `min_stock`: Int (Cảnh báo tối thiểu)
- `description`: String
- `status`: String (`Đang bán`, `Ngừng bán`)
- `created_at`: DateTime

### 3. `customers`
Bảng danh mục khách hàng.
- `id`: String (Primary Key, e.g. `KH001`)
- `name`: String (Not Null)
- `phone`: String
- `email`: String
- `tax`: String (Mã số thuế)
- `address`: String
- `representative`: String (Người đại diện)
- `note`: String
- `created_at`: DateTime

### 4. `quotes` & `quote_items`
Bảng báo giá và chi tiết mặt hàng báo giá.
- `quotes`: `id`, `customer_id`, `date`, `status` (`Nháp`, `Đã gửi`, `Đã chấp nhận`, `Đã từ chối`, `Hủy`), `discount`, `vat_pct`, `shipping`, `template_id`, `notes`, `valid_until`, `created_at`.
- `quote_items`: `id`, `quote_id`, `product_id`, `product_name`, `qty`, `price`, `discount`.

### 5. `contracts` & `contract_items`
Bảng hợp đồng và chi tiết mặt hàng hợp đồng.
- `contracts`: `id`, `quote_id`, `customer_id`, `date`, `status` (`Nháp`, `Hiệu lực`, `Hoàn thành`, `Đã hủy`), `template_id`, `stock_applied` (Boolean), `notes`, `created_at`.
- `contract_items`: `id`, `contract_id`, `product_id`, `product_name`, `qty`, `price`.

### 6. `inventory_transactions`
Bảng sổ nhật ký biến động kho.
- `id`: String (Primary Key, e.g. `XK001`, `NK001`)
- `date`: DateTime
- `product_id`: String (FK `products.id`)
- `type`: String (`Nhập kho`, `Xuất kho`, `Điều chỉnh`, `Trả hàng`)
- `qty`: Int
- `ref`: String (Mã hợp đồng / hóa đơn liên quan)
- `note`: String

### 7. `payments`
Bảng ghi nhận đợt thu tiền hợp đồng.
- `id`: String (Primary Key, e.g. `PT001`)
- `contract_id`: String (FK `contracts.id`)
- `date`: DateTime
- `amount`: BigInt
- `method`: String (`Chuyển khoản`, `Tiền mặt`, `Thẻ credit`)
- `note`: String

### 8. `templates`
Mẫu in báo giá và hợp đồng HTML.
- `id`: String (Primary Key)
- `type`: String (`quote`, `contract`)
- `name`: String
- `is_default`: Boolean
- `paper`: String (`A4`, `Letter`)
- `locked`: Boolean
- `content`: String (HTML template with mustache tags)

### 9. `email_settings` & `email_logs`
Cấu hình và nhật ký gửi email.
- `email_settings`: `sender_name`, `sender_email`, `smtp_host`, `smtp_port`, `auto_send`.
- `email_logs`: `id`, `recipient`, `subject`, `status` (`sent`, `failed`), `sent_at`, `error_msg`.
