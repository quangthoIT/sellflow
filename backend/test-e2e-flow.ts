const API_BASE = 'http://localhost:4000/api';

async function runE2ETest() {
  console.log('====================================================');
  console.log('       SELLFLOW FULL E2E BUSINESS FLOW TEST         ');
  console.log('====================================================\n');

  async function api(path: string, options: any = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  // 1. REGISTER NEW WORKSPACE
  const testEmail = `corp_${Date.now()}@e2etest.vn`;
  console.log(`[BƯỚC 1] Đăng ký công ty mới: ${testEmail}...`);
  const regRes = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: 'StrongPassword123!',
      companyName: 'Công ty Cổ phần Giải pháp E2E',
      companyPhone: '0933445566',
      companyTax: '0312349999',
      companyAddress: 'Tòa nhà Landmark 81, TP.HCM',
    }),
  });

  if (!regRes.ok || !regRes.data.token) {
    throw new Error(`Đăng ký thất bại: ${JSON.stringify(regRes.data)}`);
  }

  const token = regRes.data.token;
  const companyId = regRes.data.user.companyId;
  const headers = { Authorization: `Bearer ${token}` };
  console.log(` -> Đăng ký thành công! Company ID: ${companyId}`);

  // 2. CHECK & UPDATE SETTINGS
  console.log('\n[BƯỚC 2] Kiểm tra và cập nhật Cài đặt hệ thống...');
  const settingsGet = await api('/auth/settings', { headers });
  console.log(` -> Company Name in Settings: ${settingsGet.data.companyName}`);

  const settingsUpdate = await api('/auth/settings', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      quote_prefix: 'BG-PRO',
      contract_prefix: 'HD-PRO',
      vat_default: 8,
      quote_valid_days: 30,
    }),
  });
  console.log(` -> Cập nhật tiền tố: ${settingsUpdate.data.settings?.quotePrefix}, VAT mặc định: ${settingsUpdate.data.settings?.vatDefault}%`);

  // 3. CREATE PRODUCT
  console.log('\n[BƯỚC 3] Tạo sản phẩm mới trong kho...');
  const prodRes = await api('/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: `SP-E2E-${Date.now()}`,
      name: 'Máy chủ Cloud Dedicated Dell R750',
      category: 'Máy chủ',
      unit: 'hệ thống',
      cost: 45000000,
      price: 68000000,
      stock: 5,
      minStock: 2,
    }),
  });
  const product = prodRes.data.product;
  console.log(` -> Sản phẩm: ${product.name} (Tồn kho: ${product.stock}, Giá: ${product.price})`);

  // 4. INVENTORY STOCK-IN
  console.log('\n[BƯỚC 4] Nhập thêm kho (Inventory Transaction)...');
  const stockInRes = await api('/inventory/transaction', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId: product.id,
      type: 'Nhập kho',
      qty: 3,
      note: 'Nhập thêm 3 máy chủ từ kho tổng',
    }),
  });
  console.log(` -> Nhập kho thành công: +3 sản phẩm.`);

  // Check updated product stock
  const prodCheck = await api('/products', { headers });
  const updatedProd = prodCheck.data.find((p: any) => p.id === product.id);
  console.log(` -> Tồn kho sau nhập: ${updatedProd?.stock} (Kỳ vọng: 8)`);
  if (updatedProd?.stock !== 8) throw new Error('Stock calculation incorrect!');

  // 5. CREATE CUSTOMER
  console.log('\n[BƯỚC 5] Tạo khách hàng doanh nghiệp...');
  const custRes = await api('/customers', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: `KH-E2E-${Date.now()}`,
      name: 'Ngân hàng TMCP Việt Nam',
      phone: '0909998877',
      email: 'procurement@vietbank.vn',
      tax: '0100112233',
      address: 'Quận 1, TP. Hồ Chí Minh',
      representative: 'Nguyễn Giám Đốc',
    }),
  });
  const customer = custRes.data.customer;
  console.log(` -> Khách hàng: ${customer.name} (MST: ${customer.tax})`);

  // 6. CREATE QUOTATION
  console.log('\n[BƯỚC 6] Lập Báo giá cho khách hàng...');
  const quoteId = `BG-E2E-${Date.now()}`;
  const quoteRes = await api('/quotations', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: quoteId,
      customerId: customer.id,
      status: 'Đã gửi',
      vatPct: 8,
      discount: 2000000,
      shipping: 500000,
      items: [
        {
          productId: product.id,
          productName: product.name,
          qty: 2,
          price: 68000000,
          discount: 0,
        },
      ],
    }),
  });
  console.log(` -> Báo giá ${quoteId} tạo thành công. Trạng thái: ${quoteRes.data.quote?.status}`);

  // 7. CONVERT QUOTE TO CONTRACT
  console.log('\n[BƯỚC 7] Chuyển đổi Báo giá thành Hợp đồng kinh tế...');
  const contractId = `HD-E2E-${Date.now()}`;
  const contractRes = await api('/contracts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: contractId,
      quoteId: quoteId,
      customerId: customer.id,
      status: 'Hiệu lực',
      stockApplied: true,
      items: [
        {
          productId: product.id,
          productName: product.name,
          qty: 2,
          price: 68000000,
        },
      ],
    }),
  });
  console.log(` -> Hợp đồng ${contractId} tạo thành công. Trạng thái: ${contractRes.data.contract?.status}`);

  // Deduct stock for contract
  await api('/inventory/transaction', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId: product.id,
      type: 'Xuất kho',
      qty: 2,
      ref: contractId,
      note: `Xuất kho thực hiện hợp đồng ${contractId}`,
    }),
  });

  const stockAfterContract = await api('/products', { headers });
  const prodAfterContract = stockAfterContract.data.find((p: any) => p.id === product.id);
  console.log(` -> Tồn kho sau xuất cho Hợp đồng: ${prodAfterContract?.stock} (Kỳ vọng: 6)`);
  if (prodAfterContract?.stock !== 6) throw new Error('Stock deduction incorrect!');

  // 8. RECORD PAYMENT
  console.log('\n[BƯỚC 8] Thu tiền & Tạo phiếu thanh toán...');
  const payRes = await api('/payments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: `TT-E2E-${Date.now()}`,
      contractId: contractId,
      amount: 134000000,
      method: 'Chuyển khoản',
      note: 'Thanh toán đợt 1 (100% giá trị hợp đồng)',
    }),
  });
  console.log(` -> Phiếu thu ${payRes.data.payment?.id}: ${payRes.data.payment?.amount} VND qua ${payRes.data.payment?.method}`);

  // 9. CHECK DASHBOARD STATS
  console.log('\n[BƯỚC 9] Kiểm tra Báo cáo Dashboard & Doanh thu...');
  const dashRes = await api('/reports/dashboard', { headers });
  console.log(' -> Thống kê Dashboard:', dashRes.data);

  if (
    dashRes.data.productCount < 1 ||
    dashRes.data.customerCount < 1 ||
    dashRes.data.quoteCount < 1 ||
    dashRes.data.contractCount < 1 ||
    dashRes.data.monthlyRevenue < 134000000
  ) {
    throw new Error('Dashboard stats do not reflect business operations!');
  }

  // 10. CHECK TEMPLATES
  console.log('\n[BƯỚC 10] Kiểm tra Mẫu in ấn tài liệu...');
  const tmplRes = await api('/templates', { headers });
  console.log(` -> Số mẫu tài liệu sẵn có: ${tmplRes.data.length} mẫu.`);

  console.log('\n====================================================');
  console.log('       ALL E2E BUSINESS CHECKS PASSED 100%!         ');
  console.log('====================================================\n');
}

runE2ETest().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
