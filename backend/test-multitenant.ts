const API_BASE = 'http://localhost:4000/api';

async function runTest() {
  console.log('=== MULTI-TENANT ISOLATION TEST START ===\n');

  // Helper fetch
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

  // 1. REGISTER COMPANY ALPHA
  console.log('[1] Đăng ký Công ty Alpha...');
  const alphaReg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'alpha@testcorp.vn',
      password: 'password123',
      companyName: 'Tập đoàn Alpha',
      companyPhone: '0901111111',
      companyTax: 'MST-ALPHA-01',
    }),
  });

  if (!alphaReg.ok || !alphaReg.data.token) {
    console.error('FAIL: Không thể đăng ký Công ty Alpha:', alphaReg.data);
    process.exit(1);
  }
  const tokenAlpha = alphaReg.data.token;
  const companyAlphaId = alphaReg.data.user.companyId;
  console.log(` -> Đăng ký Alpha thành công! CompanyId: ${companyAlphaId}`);

  // Company Alpha creates data
  console.log('[2] Công ty Alpha tạo Product, Customer, Quote, Contract, Payment...');
  const pAlpha = await api('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenAlpha}` },
    body: JSON.stringify({
      id: 'SP-ALPHA-01',
      name: 'Phần mềm ERP Alpha',
      price: 15000000,
      cost: 5000000,
      stock: 10,
    }),
  });
  console.log(' -> Alpha Product:', pAlpha.data.product?.name);

  const cAlpha = await api('/customers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenAlpha}` },
    body: JSON.stringify({
      id: 'KH-ALPHA-01',
      name: 'Khách hàng VIP Alpha',
      phone: '0912345678',
    }),
  });
  console.log(' -> Alpha Customer:', cAlpha.data.customer?.name);

  const qAlpha = await api('/quotations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenAlpha}` },
    body: JSON.stringify({
      id: 'BG-ALPHA-01',
      customerId: 'KH-ALPHA-01',
      status: 'Đã gửi',
      discount: 1000000,
      items: [
        { id: 'QI-ALPHA-01', productId: 'SP-ALPHA-01', productName: 'Phần mềm ERP Alpha', qty: 1, price: 15000000 },
      ],
    }),
  });
  console.log(' -> Alpha Quote:', qAlpha.data.quote?.id);

  const ctAlpha = await api('/contracts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenAlpha}` },
    body: JSON.stringify({
      id: 'HD-ALPHA-01',
      quoteId: 'BG-ALPHA-01',
      customerId: 'KH-ALPHA-01',
      status: 'Hiệu lực',
      items: [
        { id: 'CI-ALPHA-01', productId: 'SP-ALPHA-01', productName: 'Phần mềm ERP Alpha', qty: 1, price: 15000000 },
      ],
    }),
  });
  console.log(' -> Alpha Contract:', ctAlpha.data.contract?.id);

  const payAlpha = await api('/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenAlpha}` },
    body: JSON.stringify({
      id: 'TT-ALPHA-01',
      contractId: 'HD-ALPHA-01',
      amount: 14000000,
      method: 'Chuyển khoản',
    }),
  });
  console.log(' -> Alpha Payment:', payAlpha.data.payment?.id);

  // 3. REGISTER COMPANY BETA
  console.log('\n[3] Đăng ký Công ty Beta hoàn toàn mới...');
  const betaReg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'beta@testcorp.vn',
      password: 'password456',
      companyName: 'Công ty TNHH Beta',
      companyPhone: '0902222222',
      companyTax: 'MST-BETA-02',
    }),
  });

  if (!betaReg.ok || !betaReg.data.token) {
    console.error('FAIL: Không thể đăng ký Công ty Beta:', betaReg.data);
    process.exit(1);
  }
  const tokenBeta = betaReg.data.token;
  const companyBetaId = betaReg.data.user.companyId;
  console.log(` -> Đăng ký Beta thành công! CompanyId: ${companyBetaId}`);

  // 4. VERIFY COMPANY BETA IS COMPLETELY ISOLATED (EMPTY LISTS)
  console.log('\n[4] Kiểm tra Công ty Beta xem có bị lộ dữ liệu của Alpha hay không...');
  const betaProducts = await api('/products', { headers: { Authorization: `Bearer ${tokenBeta}` } });
  const betaCustomers = await api('/customers', { headers: { Authorization: `Bearer ${tokenBeta}` } });
  const betaQuotes = await api('/quotations', { headers: { Authorization: `Bearer ${tokenBeta}` } });
  const betaContracts = await api('/contracts', { headers: { Authorization: `Bearer ${tokenBeta}` } });
  const betaPayments = await api('/payments', { headers: { Authorization: `Bearer ${tokenBeta}` } });
  const betaDashboard = await api('/reports/dashboard', { headers: { Authorization: `Bearer ${tokenBeta}` } });

  console.log(` -> Beta Products count: ${betaProducts.data.length} (Expected: 0)`);
  console.log(` -> Beta Customers count: ${betaCustomers.data.length} (Expected: 0)`);
  console.log(` -> Beta Quotes count: ${betaQuotes.data.length} (Expected: 0)`);
  console.log(` -> Beta Contracts count: ${betaContracts.data.length} (Expected: 0)`);
  console.log(` -> Beta Payments count: ${betaPayments.data.length} (Expected: 0)`);
  console.log(` -> Beta Dashboard:`, betaDashboard.data);

  if (
    betaProducts.data.length !== 0 ||
    betaCustomers.data.length !== 0 ||
    betaQuotes.data.length !== 0 ||
    betaContracts.data.length !== 0 ||
    betaPayments.data.length !== 0 ||
    betaDashboard.data.productCount !== 0 ||
    betaDashboard.data.customerCount !== 0
  ) {
    console.error('FAIL: Dữ liệu của Alpha bị lộ sang Beta!');
    process.exit(1);
  }
  console.log(' -> PASSED: Công ty Beta hoàn toàn độc lập, không thấy dữ liệu nào của Alpha!');

  // 5. TEST CROSS-TENANT DIRECT ACCESS ATTEMPTS BY ID
  console.log('\n[5] Kiểm tra tấn công truy cập chéo bằng ID trực tiếp (Direct URL/API Access)...');
  const directQuote = await api('/quotations/BG-ALPHA-01', { headers: { Authorization: `Bearer ${tokenBeta}` } });
  console.log(` -> Beta truy cập Quote của Alpha: status=${directQuote.status} (Expected: 404/500/Error)`);

  const directContract = await api('/contracts/HD-ALPHA-01', { headers: { Authorization: `Bearer ${tokenBeta}` } });
  console.log(` -> Beta truy cập Contract của Alpha: status=${directContract.status} (Expected: 404/500/Error)`);

  const directDelete = await api('/products/SP-ALPHA-01', { method: 'DELETE', headers: { Authorization: `Bearer ${tokenBeta}` } });
  console.log(` -> Beta xóa Product của Alpha: status=${directDelete.status} (Expected: 404/Error)`);

  if (directQuote.ok || directContract.ok || directDelete.ok) {
    console.error('FAIL: Lỗ hổng bảo mật: Beta có thể truy cập hoặc xóa dữ liệu của Alpha bằng ID trực tiếp!');
    process.exit(1);
  }
  console.log(' -> PASSED: Mọi truy cập trái phép chéo công ty đều bị chặn 100%!');

  // 6. COMPANY BETA CREATES ITS OWN DATA
  console.log('\n[6] Công ty Beta tạo dữ liệu riêng...');
  await api('/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBeta}` },
    body: JSON.stringify({
      id: 'SP-BETA-01',
      name: 'Máy in hóa đơn Beta',
      price: 2500000,
      cost: 1800000,
      stock: 50,
    }),
  });

  await api('/customers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenBeta}` },
    body: JSON.stringify({
      id: 'KH-BETA-01',
      name: 'Đại lý Beta Miền Bắc',
      phone: '0988888888',
    }),
  });

  // 7. VERIFY COMPANY ALPHA ONLY SEES ALPHA DATA
  console.log('\n[7] Đăng nhập lại Công ty Alpha kiểm tra...');
  const alphaLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'alpha@testcorp.vn', password: 'password123' }),
  });
  const reTokenAlpha = alphaLogin.data.token;

  const alphaProductsFinal = await api('/products', { headers: { Authorization: `Bearer ${reTokenAlpha}` } });
  const alphaCustomersFinal = await api('/customers', { headers: { Authorization: `Bearer ${reTokenAlpha}` } });

  console.log(` -> Alpha Final Products count: ${alphaProductsFinal.data.length}`);
  console.log(` -> Alpha Final Products IDs: ${alphaProductsFinal.data.map((p: any) => p.id).join(', ')}`);
  console.log(` -> Alpha Final Customers IDs: ${alphaCustomersFinal.data.map((c: any) => c.id).join(', ')}`);

  if (
    alphaProductsFinal.data.length !== 1 ||
    alphaProductsFinal.data[0].id !== 'SP-ALPHA-01' ||
    alphaCustomersFinal.data.length !== 1 ||
    alphaCustomersFinal.data[0].id !== 'KH-ALPHA-01'
  ) {
    console.error('FAIL: Dữ liệu của Beta bị lẫn vào Alpha!');
    process.exit(1);
  }

  console.log('\n=== ALL MULTI-TENANT ISOLATION TESTS PASSED 100% SUCCESSFULLY! ===');
}

runTest().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
