import { PrismaClient } from '@prisma/client';

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
  const defaultTemplates = [
    {
      id: 'TMP-BG-01',
      type: 'quote',
      name: 'Mẫu Báo Giá Chuẩn Doanh Nghiệp',
      isDefault: true,
      paper: 'A4',
      locked: false,
      content: `<div style="font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.4; color: #111; max-width: 800px; margin: 0 auto; padding: 24px 32px;">
  <!-- Header: Công ty & Logo -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
    <tr>
      <td style="width: 25%; vertical-align: middle; text-align: left;">
        {{LOGO_CONG_TY}}
      </td>
      <td style="width: 75%; vertical-align: middle; text-align: right; font-size: 10.5pt; line-height: 1.4;">
        <strong style="font-size: 13pt; color: #0f172a; text-transform: uppercase;">{{TEN_CONG_TY}}</strong><br/>
        <span>Địa chỉ: {{DIA_CHI_CONG_TY}}</span><br/>
        <span>Điện thoại: {{SDT_CONG_TY}} | Email: {{EMAIL_CONG_TY}}</span><br/>
        <span>Mã số thuế: {{MST_CONG_TY}}</span>
      </td>
    </tr>
  </table>

  <!-- Tiêu đề Báo giá -->
  <div style="text-align: center; margin: 24px 0 20px 0;">
    <h2 style="font-size: 18pt; font-weight: bold; color: #0f172a; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">BẢNG BÁO GIÁ SẢN PHẨM & DỊCH VỤ</h2>
    <div style="font-size: 11pt; font-style: italic; color: #475569;">
      Số: <strong>{{SO_TAI_LIEU}}</strong> | Ngày: {{NGAY}}
    </div>
  </div>

  <!-- Thông tin Khách hàng -->
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; font-size: 11.5pt;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 18%; font-weight: bold; color: #334155; padding: 3px 0;">Kính gửi:</td>
        <td style="width: 82%; font-weight: bold; color: #0f172a; font-size: 12pt;">{{TEN_KHACH_HANG}}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #334155; padding: 3px 0;">Địa chỉ:</td>
        <td style="color: #1e293b;">{{DIA_CHI_KHACH_HANG}}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #334155; padding: 3px 0;">Mã số thuế:</td>
        <td style="color: #1e293b;">{{MST_KHACH_HANG}}</td>
      </tr>
    </table>
  </div>

  <p style="margin-bottom: 12px; font-size: 11.5pt;">
    Chúng tôi xin trân trọng gửi tới Quý khách hàng bảng báo giá chi tiết cho các sản phẩm/dịch vụ theo yêu cầu như sau:
  </p>

  <!-- Bảng sản phẩm -->
  <div style="margin-bottom: 16px;">
    {{BANG_SAN_PHAM}}
  </div>

  <!-- Bảng Tổng kết chi phí -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 24px; font-size: 11.5pt;">
    <tr>
      <td style="width: 55%; vertical-align: top; padding-right: 16px;">
        <div style="font-size: 10.5pt; color: #475569; font-style: italic;">
          * Báo giá đã bao gồm các hỗ trợ kỹ thuật tiêu chuẩn và chính sách bảo hành chính hãng.
        </div>
      </td>
      <td style="width: 45%; vertical-align: top;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 8px; text-align: left; color: #475569;">Cộng tiền hàng:</td>
            <td style="padding: 4px 8px; text-align: right; font-weight: bold;">{{TAM_TINH}}</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; text-align: left; color: #475569;">Thuế GTGT (VAT):</td>
            <td style="padding: 4px 8px; text-align: right; font-weight: bold;">{{VAT}}</td>
          </tr>
          <tr style="border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; background-color: #f1f5f9;">
            <td style="padding: 8px 8px; text-align: left; font-weight: bold; color: #0f172a; font-size: 12pt;">TỔNG CỘNG:</td>
            <td style="padding: 8px 8px; text-align: right; font-weight: bold; color: #b91c1c; font-size: 13pt;">{{TONG_TIEN}}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Điều khoản & Điều kiện -->
  <div style="margin-bottom: 24px; font-size: 11pt; line-height: 1.5;">
    <strong style="color: #0f172a; font-size: 11.5pt;">ĐIỀU KHOẢN VÀ ĐIỀU KIỆN THƯƠNG MẠI:</strong>
    <ol style="margin-top: 6px; padding-left: 20px; color: #334155;">
      <li><strong>Hiệu lực báo giá:</strong> Báo giá có hiệu lực trong vòng 15 ngày kể từ ngày phát hành.</li>
      <li><strong>Điều khoản thanh toán:</strong> {{DIEU_KHOAN_THANH_TOAN}}</li>
      <li><strong>Thời gian giao hàng:</strong> Trong vòng 03 - 05 ngày làm việc kể từ ngày xác nhận đơn hàng / ký kết hợp đồng.</li>
      <li><strong>Ghi chú bổ sung:</strong> {{GHI_CHU}}</li>
    </ol>
  </div>

  <!-- Chữ ký đại diện 2 bên -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 30px; page-break-inside: avoid;">
    <tr>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <strong style="color: #0f172a; text-transform: uppercase;">ĐẠI DIỆN KHÁCH HÀNG</strong><br/>
        <em style="font-size: 11pt; color: #475569;">(Ký, ghi rõ họ tên)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #0f172a; font-size: 12pt;">{{TEN_KHACH_HANG}}</strong>
      </td>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <strong style="color: #0f172a; text-transform: uppercase;">ĐẠI DIỆN BÊN BÁN</strong><br/>
        <em style="font-size: 11pt; color: #475569;">(Ký, ghi rõ họ tên & đóng dấu)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #0f172a; font-size: 12pt;">{{TEN_CONG_TY}}</strong>
      </td>
    </tr>
  </table>
</div>`,
    },
    {
      id: 'TMP-HD-01',
      type: 'contract',
      name: 'Mẫu Hợp Đồng Kinh Tế Chuẩn',
      isDefault: true,
      paper: 'A4',
      locked: false,
      content: `<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.4; color: #111; max-width: 800px; margin: 0 auto; padding: 0;">
  <!-- Quốc hiệu & Tiêu ngữ chuẩn Việt Nam -->
  <div style="text-align: center; margin-bottom: 12px;">
    <div style="font-size: 11.5pt; font-weight: bold; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div style="font-size: 12pt; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</div>
    <div style="font-size: 10.5pt; color: #475569; margin-top: 2px;">---------------o0o---------------</div>
  </div>

  <!-- Tiêu đề Hợp đồng -->
  <div style="text-align: center; margin-bottom: 14px;">
    <h2 style="font-size: 15pt; font-weight: bold; color: #0f172a; margin: 0 0 4px 0; text-transform: uppercase;">HỢP ĐỒNG KINH TẾ MUA BÁN HÀNG HÓA</h2>
    <div style="font-size: 11pt; font-style: italic; color: #334155;">
      Số: <strong>{{SO_TAI_LIEU}}</strong>
    </div>
  </div>

  <!-- Căn cứ pháp lý -->
  <div style="font-size: 10.5pt; font-style: italic; color: #475569; margin-bottom: 10px; line-height: 1.35;">
    - Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015;<br/>
    - Căn cứ Luật Thương mại số 36/2005/QH11 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 14/06/2005;<br/>
    - Căn cứ vào nhu cầu và khả năng thực tế của hai Bên.
  </div>

  <p style="margin-bottom: 8px; font-size: 11pt;">
    Hôm nay, ngày {{NGAY}}, tại văn phòng đại diện, chúng tôi gồm có:
  </p>

  <!-- BÊN A -->
  <div style="margin-bottom: 8px; font-size: 11pt;">
    <strong style="color: #0f172a; text-transform: uppercase;">BÊN BÁN (BÊN A): {{TEN_CONG_TY}}</strong>
    <table style="width: 100%; border-collapse: collapse; margin-top: 2px; margin-left: 8px;">
      <tr>
        <td style="width: 18%; padding: 1px 0;">Địa chỉ:</td>
        <td style="width: 82%; font-weight: 500;">{{DIA_CHI_CONG_TY}}</td>
      </tr>
      <tr>
        <td style="padding: 1px 0;">Mã số thuế:</td>
        <td style="font-weight: 500;">{{MST_CONG_TY}}</td>
      </tr>
      <tr>
        <td style="padding: 1px 0;">Điện thoại:</td>
        <td>{{SDT_CONG_TY}} &nbsp;&nbsp;|&nbsp;&nbsp; Email: {{EMAIL_CONG_TY}}</td>
      </tr>
    </table>
  </div>

  <!-- BÊN B -->
  <div style="margin-bottom: 10px; font-size: 11pt;">
    <strong style="color: #0f172a; text-transform: uppercase;">BÊN MUA (BÊN B): {{TEN_KHACH_HANG}}</strong>
    <table style="width: 100%; border-collapse: collapse; margin-top: 2px; margin-left: 8px;">
      <tr>
        <td style="width: 18%; padding: 1px 0;">Địa chỉ:</td>
        <td style="width: 82%; font-weight: 500;">{{DIA_CHI_KHACH_HANG}}</td>
      </tr>
      <tr>
        <td style="padding: 1px 0;">Mã số thuế:</td>
        <td style="font-weight: 500;">{{MST_KHACH_HANG}}</td>
      </tr>
    </table>
  </div>

  <p style="margin-bottom: 10px; font-size: 11pt;">
    Hai bên cùng nhau thỏa thuận thống nhất ký kết Hợp đồng kinh tế với các điều khoản sau:
  </p>

  <!-- ĐIỀU 1 -->
  <div style="margin-bottom: 10px; font-size: 11pt;">
    <strong style="color: #0f172a;">ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG & DANH MỤC HÀNG HÓA</strong>
    <p style="margin: 3px 0 6px 0;">Bên A đồng ý cung cấp và Bên B đồng ý mua danh mục sản phẩm/dịch vụ theo chi tiết dưới đây:</p>
    <div style="margin-bottom: 6px;">
      {{BANG_SAN_PHAM}}
    </div>
  </div>

  <!-- ĐIỀU 2 -->
  <div style="margin-bottom: 8px; font-size: 11pt;">
    <strong style="color: #0f172a;">ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN</strong>
    <p style="margin: 3px 0 4px 0;">
      1. Tổng giá trị hợp đồng (Đã bao gồm thuế GTGT): <strong style="color: #b91c1c; font-size: 12pt;">{{TONG_TIEN}}</strong>.
    </p>
    <p style="margin: 3px 0 4px 0;">
      2. Phương thức thanh toán: Chuyển khoản qua tài khoản ngân hàng của Bên A hoặc tiền mặt.
    </p>
  </div>

  <!-- ĐIỀU 3 -->
  <div style="margin-bottom: 8px; font-size: 11pt;">
    <strong style="color: #0f172a;">ĐIỀU 3: THỜI GIAN VÀ ĐỊA ĐIỂM GIAO HÀNG</strong>
    <p style="margin: 3px 0 4px 0;">
      1. Thời gian giao hàng: Theo đúng thỏa thuận hoặc trong vòng 05 ngày làm việc kể từ ngày Bên B hoàn tất thủ tục đặt cọc/thanh toán.
    </p>
    <p style="margin: 3px 0 4px 0;">
      2. Địa điểm giao hàng: Tại địa chỉ của Bên B hoặc địa điểm do Bên B chỉ định bằng văn bản.
    </p>
  </div>

  <!-- Điểm ngắt trang sang Trang 2 -->
  <div data-page-break="true" style="page-break-before: always; margin: 20px 0; padding: 8px 0; border-top: 2px dashed #94a3b8; text-align: center; font-size: 11px; font-weight: 600; color: #64748b; user-select: none;">
    ✂ --- NGẮT TRANG (SANG TRANG 2) ---
  </div>

  <!-- ĐIỀU 4 -->
  <div style="margin-bottom: 12px; font-size: 11pt; padding-top: 8px;">
    <strong style="color: #0f172a;">ĐIỀU 4: TRÁCH NHIỆM CỦA CÁC BÊN</strong>
    <p style="margin: 3px 0 4px 0;">
      - <strong>Bên A:</strong> Cung cấp hàng hóa đúng chủng loại, quy cách, chất lượng và số lượng đã thỏa thuận; bảo hành hàng hóa theo tiêu chuẩn.
    </p>
    <p style="margin: 3px 0 4px 0;">
      - <strong>Bên B:</strong> Tiếp nhận hàng hóa, kiểm tra và thực hiện thanh toán cho Bên A đúng tiến độ quy định tại Hợp đồng.
    </p>
  </div>

  <!-- ĐIỀU 5 -->
  <div style="margin-bottom: 16px; font-size: 11pt;">
    <strong style="color: #0f172a;">ĐIỀU 5: ĐIỀU KHOẢN CHUNG VÀ HIỆU LỰC THI HÀNH</strong>
    <p style="margin: 3px 0 4px 0;">
      1. Hợp đồng có hiệu lực kể từ ngày ký. Mọi sửa đổi, bổ sung phải được lập thành văn bản (Phụ lục hợp đồng) có chữ ký xác nhận của cả hai Bên.
    </p>
    <p style="margin: 3px 0 4px 0;">
      2. Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản để cùng thực hiện.
    </p>
  </div>

  <!-- Chữ ký đại diện 2 bên -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px; page-break-inside: avoid;">
    <tr>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <strong style="color: #0f172a; text-transform: uppercase; font-size: 11.5pt;">ĐẠI DIỆN BÊN B (BÊN MUA)</strong><br/>
        <em style="font-size: 10.5pt; color: #475569;">(Ký, ghi rõ họ tên)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #0f172a; font-size: 11.5pt;">{{TEN_KHACH_HANG}}</strong>
      </td>
      <td style="width: 50%; text-align: center; vertical-align: top;">
        <strong style="color: #0f172a; text-transform: uppercase; font-size: 11.5pt;">ĐẠI DIỆN BÊN A (BÊN BÁN)</strong><br/>
        <em style="font-size: 10.5pt; color: #475569;">(Ký, ghi rõ họ tên & đóng dấu)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #0f172a; font-size: 11.5pt;">{{TEN_CONG_TY}}</strong>
      </td>
    </tr>
  </table>
</div>`,
    },
  ];

  for (const t of defaultTemplates) {
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
