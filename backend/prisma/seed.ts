import { PrismaClient } from '@prisma/client';
import { DEFAULT_TEMPLATES } from '../src/modules/templates/default-templates.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Prisma Database Seeding with Multi-Tenant Architecture...');

  // 1. Create or Find Demo Company
  const companyEmail = 'admin@sellflow.vn';
  let company = await prisma.company.findFirst({
    where: { email: companyEmail },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Công ty TNHH SellFlow Demo',
        email: companyEmail,
        phone: '0901234567',
        tax: '0109998888',
        address: 'Tầng 12, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh',
        logoUrl: '',
      },
    });
    console.log(` -> Created Demo Company: ${company.name} (${company.id})`);
  }

  // 2. Create or Update Demo Admin User
  await prisma.user.upsert({
    where: { email: companyEmail },
    update: {
      name: 'Quản trị viên - SellFlow Demo',
      companyId: company.id,
      role: 'ADMIN',
    },
    create: {
      email: companyEmail,
      password: 'password123',
      name: 'Quản trị viên - SellFlow Demo',
      companyId: company.id,
      role: 'ADMIN',
    },
  });

  // 3. Create or Update Company AppSettings
  await prisma.appSetting.upsert({
    where: { companyId: company.id },
    update: {
      companyName: 'Công ty TNHH SellFlow Demo',
      companyEmail: companyEmail,
      companyPhone: '0901234567',
      companyTax: '0109998888',
      companyAddress: 'Tầng 12, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh',
    },
    create: {
      companyId: company.id,
      companyName: 'Công ty TNHH SellFlow Demo',
      companyEmail: companyEmail,
      companyPhone: '0901234567',
      companyTax: '0109998888',
      companyAddress: 'Tầng 12, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh',
    },
  });

  // 4. Create or Update Company EmailSettings
  await prisma.emailSetting.upsert({
    where: { companyId: company.id },
    update: {
      senderName: 'Bộ phận Bán hàng - SellFlow Demo',
      senderEmail: companyEmail,
    },
    create: {
      companyId: company.id,
      senderName: 'Bộ phận Bán hàng - SellFlow Demo',
      senderEmail: companyEmail,
    },
  });

  // 5. Seed Products linked to Demo Company
  const products = [
    { id: 'SP001', companyId: company.id, name: 'Máy tính xách tay Dell XPS 15', category: 'Thiết bị điện tử', unit: 'bộ', cost: BigInt(22000000), price: BigInt(28500000), stock: 15, minStock: 5, description: 'Core i7, 16GB RAM, 512GB SSD' },
    { id: 'SP002', companyId: company.id, name: 'Màn hình Dell UltraSharp 27 inch', category: 'Thiết bị điện tử', unit: 'cái', cost: BigInt(7000000), price: BigInt(9200000), stock: 25, minStock: 8, description: 'Độ phân giải 4K IPS' },
    { id: 'SP003', companyId: company.id, name: 'Bàn phím cơ Logi MX Keys', category: 'Phụ kiện', unit: 'cái', cost: BigInt(1800000), price: BigInt(2600000), stock: 40, minStock: 10, description: 'Kết nối không dây đa thiết bị' },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        category: prod.category,
        unit: prod.unit,
        cost: prod.cost,
        price: prod.price,
        stock: prod.stock,
        minStock: prod.minStock,
        description: prod.description,
        companyId: company.id,
      },
      create: prod,
    });
  }

  // 6. Seed Customers linked to Demo Company
  const customers = [
    { id: 'KH001', companyId: company.id, name: 'Công ty TNHH Công nghệ Alpha', phone: '0901234567', email: 'contact@alpha.vn', tax: '0101234567', address: 'Tầng 5, Tòa nhà Landmark 81, TP. Hồ Chí Minh', representative: 'Nguyễn Văn A' },
    { id: 'KH002', companyId: company.id, name: 'Tập đoàn Giải pháp Beta', phone: '0988776655', email: 'info@beta.com', tax: '0309876543', address: 'Số 12 QL1A, Quận Cầu Giấy, Hà Nội', representative: 'Trần Thị B' },
  ];

  for (const cust of customers) {
    await prisma.customer.upsert({
      where: { id: cust.id },
      update: {
        name: cust.name,
        phone: cust.phone,
        email: cust.email,
        tax: cust.tax,
        address: cust.address,
        representative: cust.representative,
        companyId: company.id,
      },
      create: cust,
    });
  }

  // 7. Seed Templates per Company
  for (const t of DEFAULT_TEMPLATES) {
    const tmplId = `${company.id}_${t.id}`;
    await prisma.template.upsert({
      where: { id: tmplId },
      update: {
        name: t.name,
        type: t.type,
        paper: t.paper,
        content: t.content,
        isDefault: t.isDefault,
        companyId: company.id,
      },
      create: {
        id: tmplId,
        companyId: company.id,
        name: t.name,
        type: t.type,
        paper: t.paper,
        content: t.content,
        isDefault: t.isDefault,
        locked: t.locked,
      },
    });
  }

  console.log('✅ Multi-Tenant Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
