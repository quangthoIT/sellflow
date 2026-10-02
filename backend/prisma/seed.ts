import { PrismaClient } from '@prisma/client';
import { DEFAULT_TEMPLATES } from '../src/modules/templates/default-templates';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Prisma Database Seeding...');

  // 1. Seed Products
  const products = [
    { id: 'SP001', name: 'Máy tính xách tay Dell XPS 15', category: 'Thiết bị điện tử', unit: 'bộ', cost: BigInt(22000000), price: BigInt(28500000), stock: 15, minStock: 5, description: 'Core i7, 16GB RAM, 512GB SSD' },
    { id: 'SP002', name: 'Màn hình Dell UltraSharp 27 inch', category: 'Thiết bị điện tử', unit: 'cái', cost: BigInt(7000000), price: BigInt(9200000), stock: 25, minStock: 8, description: 'Độ phân giải 4K IPS' },
    { id: 'SP003', name: 'Bàn phím cơ Logi MX Keys', category: 'Phụ kiện', unit: 'cái', cost: BigInt(1800000), price: BigInt(2600000), stock: 40, minStock: 10, description: 'Kết nối không dây đa thiết bị' },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: prod,
      create: prod,
    });
  }

  // 2. Seed Customers
  const customers = [
    { id: 'KH001', name: 'Công ty TNHH Công nghệ Alpha', phone: '0901234567', email: 'contact@alpha.vn', tax: '0101234567', address: 'Tầng 5, Tòa nhà Landmark 81, TP. Hồ Chí Minh', representative: 'Nguyễn Văn A' },
    { id: 'KH002', name: 'Tập đoàn Giải pháp Beta', phone: '0988776655', email: 'info@beta.com', tax: '0309876543', address: 'Số 12 QL1A, Quận Cầu Giấy, Hà Nội', representative: 'Trần Thị B' },
  ];

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { id: cust.id },
      update: cust,
      create: cust,
    });
  }

  // 3. Seed Default Templates (Standard Quotation & Contract)
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.template.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        type: t.type,
        paper: t.paper,
        content: t.content,
        isDefault: t.isDefault,
      },
      create: t,
    });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
