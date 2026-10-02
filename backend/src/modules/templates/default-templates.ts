export const DEFAULT_TEMPLATES = [
  {
    id: 'TMP-BG-01',
    type: 'quote',
    name: 'Mẫu Báo Giá Chuẩn Doanh Nghiệp',
    isDefault: true,
    paper: 'A4',
    locked: false,
    content: `<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.4; color: #000000; max-width: 800px; margin: 0 auto; padding: 12px 16px;">
  <!-- Header: Công ty & Logo -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #000000; padding-bottom: 12px;">
    <tr>
      <td style="width: 25%; vertical-align: middle; text-align: left;">
        {{LOGO_CONG_TY}}
      </td>
      <td style="width: 75%; vertical-align: middle; text-align: right; font-size: 12pt; line-height: 1.4; color: #000000;">
        <strong style="font-size: 12pt; color: #000000; text-transform: uppercase;">{{TEN_CONG_TY}}</strong><br/>
        <span>Địa chỉ: {{DIA_CHI_CONG_TY}}</span><br/>
        <span>Điện thoại: {{SDT_CONG_TY}} | Email: {{EMAIL_CONG_TY}}</span><br/>
        <span>Mã số thuế: {{MST_CONG_TY}}</span>
      </td>
    </tr>
  </table>

  <!-- Tiêu đề Báo giá -->
  <div style="text-align: center; margin: 24px 0 20px 0;">
    <h2 style="font-size: 16pt; font-weight: bold; color: #000000; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">BẢNG BÁO GIÁ SẢN PHẨM & DỊCH VỤ</h2>
    <div style="font-size: 12pt; font-style: italic; color: #000000;">
      Số: <strong>{{SO_TAI_LIEU}}</strong> | Ngày: {{NGAY}}
    </div>
  </div>

  <!-- Thông tin Khách hàng -->
  <div style="border: 1px solid #000000; border-radius: 4px; padding: 12px 16px; margin-bottom: 20px; font-size: 12pt; color: #000000;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 18%; font-weight: bold; color: #000000; padding: 3px 0;">Kính gửi:</td>
        <td style="width: 82%; font-weight: bold; color: #000000; font-size: 12pt;">{{TEN_KHACH_HANG}}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #000000; padding: 3px 0;">Địa chỉ:</td>
        <td style="color: #000000;">{{DIA_CHI_KHACH_HANG}}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #000000; padding: 3px 0;">Mã số thuế:</td>
        <td style="color: #000000;">{{MST_KHACH_HANG}}</td>
      </tr>
    </table>
  </div>

  <p style="margin-bottom: 12px; font-size: 12pt; color: #000000;">
    Chúng tôi xin trân trọng gửi tới Quý khách hàng bảng báo giá chi tiết cho các sản phẩm/dịch vụ theo yêu cầu như sau:
  </p>

  <!-- Bảng sản phẩm -->
  <div style="margin-bottom: 16px;">
    {{BANG_SAN_PHAM}}
  </div>

  <!-- Điều khoản & Điều kiện -->
  <div style="margin-bottom: 24px; font-size: 12pt; line-height: 1.5; color: #000000;">
    <strong style="color: #000000; font-size: 12pt;">ĐIỀU KHOẢN VÀ ĐIỀU KIỆN THƯƠNG MẠI:</strong>
    <ol style="margin-top: 6px; padding-left: 20px; color: #000000;">
      <li><strong>Hiệu lực báo giá:</strong> Báo giá có hiệu lực trong vòng 15 ngày kể từ ngày phát hành.</li>
      <li><strong>Điều khoản thanh toán:</strong> {{DIEU_KHOAN_THANH_TOAN}}</li>
      <li><strong>Thời gian giao hàng:</strong> Trong vòng 03 - 05 ngày làm việc kể từ ngày xác nhận đơn hàng / ký kết hợp đồng.</li>
      <li><strong>Ghi chú bổ sung:</strong> {{GHI_CHU}}</li>
    </ol>
  </div>

  <!-- Chữ ký đại diện 2 bên -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 30px; page-break-inside: avoid; font-size: 12pt; color: #000000;">
    <tr>
      <td style="width: 50%; text-align: center; vertical-align: top; color: #000000;">
        <strong style="color: #000000; text-transform: uppercase;">ĐẠI DIỆN KHÁCH HÀNG</strong><br/>
        <em style="font-size: 12pt; color: #000000;">(Ký, ghi rõ họ tên)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #000000; font-size: 12pt;">{{TEN_KHACH_HANG}}</strong>
      </td>
      <td style="width: 50%; text-align: center; vertical-align: top; color: #000000;">
        <strong style="color: #000000; text-transform: uppercase;">ĐẠI DIỆN BÊN BÁN</strong><br/>
        <em style="font-size: 12pt; color: #000000;">(Ký, ghi rõ họ tên & đóng dấu)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #000000; font-size: 12pt;">{{TEN_CONG_TY}}</strong>
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
    content: `<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.4; color: #000000; max-width: 800px; margin: 0 auto; padding: 0;">
  <!-- Quốc hiệu & Tiêu ngữ chuẩn Việt Nam -->
  <div style="text-align: center; margin-bottom: 12px; color: #000000;">
    <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase; color: #000000;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
    <div style="font-size: 12pt; font-weight: bold; color: #000000;">Độc lập - Tự do - Hạnh phúc</div>
    <div style="font-size: 12pt; color: #000000; margin-top: 2px;">---------------o0o---------------</div>
  </div>

  <!-- Tiêu đề Hợp đồng -->
  <div style="text-align: center; margin-bottom: 14px;">
    <h2 style="font-size: 16pt; font-weight: bold; color: #000000; margin: 0 0 4px 0; text-transform: uppercase;">HỢP ĐỒNG KINH TẾ MUA BÁN HÀNG HÓA</h2>
    <div style="font-size: 12pt; font-style: italic; color: #000000;">
      Số: <strong>{{SO_TAI_LIEU}}</strong>
    </div>
  </div>

  <!-- Căn cứ pháp lý -->
  <div style="font-size: 12pt; font-style: italic; color: #000000; margin-bottom: 10px; line-height: 1.35;">
    - Căn cứ Bộ luật Dân sự số 91/2015/QH13 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 24/11/2015;<br/>
    - Căn cứ Luật Thương mại số 36/2005/QH11 được Quốc hội nước CHXHCN Việt Nam thông qua ngày 14/06/2005;<br/>
    - Căn cứ vào nhu cầu và khả năng thực tế của hai Bên.
  </div>

  <p style="margin-bottom: 8px; font-size: 12pt; color: #000000;">
    Hôm nay, ngày {{NGAY}}, tại văn phòng đại diện, chúng tôi gồm có:
  </p>

  <!-- BÊN A -->
  <div style="margin-bottom: 8px; font-size: 12pt; color: #000000;">
    <strong style="color: #000000; text-transform: uppercase;">BÊN BÁN (BÊN A): {{TEN_CONG_TY}}</strong>
    <table style="width: 100%; border-collapse: collapse; margin-top: 2px; margin-left: 8px; font-size: 12pt; color: #000000;">
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
  <div style="margin-bottom: 10px; font-size: 12pt; color: #000000;">
    <strong style="color: #000000; text-transform: uppercase;">BÊN MUA (BÊN B): {{TEN_KHACH_HANG}}</strong>
    <table style="width: 100%; border-collapse: collapse; margin-top: 2px; margin-left: 8px; font-size: 12pt; color: #000000;">
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

  <p style="margin-bottom: 10px; font-size: 12pt; color: #000000;">
    Hai bên cùng nhau thỏa thuận thống nhất ký kết Hợp đồng kinh tế với các điều khoản sau:
  </p>

  <!-- ĐIỀU 1 -->
  <div style="margin-bottom: 10px; font-size: 12pt; color: #000000;">
    <strong style="color: #000000;">ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG & DANH MỤC HÀNG HÓA</strong>
    <p style="margin: 3px 0 6px 0;">Bên A đồng ý cung cấp và Bên B đồng ý mua danh mục sản phẩm/dịch vụ theo chi tiết dưới đây:</p>
    <div style="margin-bottom: 6px;">
      {{BANG_SAN_PHAM}}
    </div>
  </div>

  <!-- ĐIỀU 2 -->
  <div style="margin-bottom: 8px; font-size: 12pt; color: #000000;">
    <strong style="color: #000000;">ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG VÀ PHƯƠNG THỨC THANH TOÁN</strong>
    <p style="margin: 3px 0 4px 0;">
      1. Tổng giá trị hợp đồng (Đã bao gồm thuế GTGT): <strong style="color: #000000; font-size: 12pt;">{{TONG_TIEN}}</strong>.
    </p>
    <p style="margin: 3px 0 4px 0;">
      2. Phương thức thanh toán: {{DIEU_KHOAN_THANH_TOAN}}
    </p>
  </div>

  <!-- ĐIỀU 3 -->
  <div style="margin-bottom: 8px; font-size: 12pt; color: #000000;">
    <strong style="color: #000000;">ĐIỀU 3: THỜI GIAN VÀ ĐỊA ĐIỂM GIAO HÀNG</strong>
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
  <div style="margin-bottom: 12px; font-size: 12pt; padding-top: 8px; color: #000000;">
    <strong style="color: #000000;">ĐIỀU 4: TRÁCH NHIỆM CỦA CÁC BÊN</strong>
    <p style="margin: 3px 0 4px 0;">
      - <strong>Bên A:</strong> Cung cấp hàng hóa đúng chủng loại, quy cách, chất lượng và số lượng đã thỏa thuận; bảo hành hàng hóa theo tiêu chuẩn.
    </p>
    <p style="margin: 3px 0 4px 0;">
      - <strong>Bên B:</strong> Tiếp nhận hàng hóa, kiểm tra và thực hiện thanh toán cho Bên A đúng tiến độ quy định tại Hợp đồng.
    </p>
  </div>

  <!-- ĐIỀU 5 -->
  <div style="margin-bottom: 16px; font-size: 12pt; color: #000000;">
    <strong style="color: #000000;">ĐIỀU 5: ĐIỀU KHOẢN CHUNG VÀ HIỆU LỰC THI HÀNH</strong>
    <p style="margin: 3px 0 4px 0;">
      1. Hợp đồng có hiệu lực kể từ ngày ký. Mọi sửa đổi, bổ sung phải được lập thành văn bản (Phụ lục hợp đồng) có chữ ký xác nhận của cả hai Bên.
    </p>
    <p style="margin: 3px 0 4px 0;">
      2. Hợp đồng được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản để cùng thực hiện.
    </p>
  </div>

  <!-- Chữ ký đại diện 2 bên -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px; page-break-inside: avoid; font-size: 12pt; color: #000000;">
    <tr>
      <td style="width: 50%; text-align: center; vertical-align: top; color: #000000;">
        <strong style="color: #000000; text-transform: uppercase; font-size: 12pt;">ĐẠI DIỆN BÊN B (BÊN MUA)</strong><br/>
        <em style="font-size: 12pt; color: #000000;">(Ký, ghi rõ họ tên)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #000000; font-size: 12pt;">{{TEN_KHACH_HANG}}</strong>
      </td>
      <td style="width: 50%; text-align: center; vertical-align: top; color: #000000;">
        <strong style="color: #000000; text-transform: uppercase; font-size: 12pt;">ĐẠI DIỆN BÊN A (BÊN BÁN)</strong><br/>
        <em style="font-size: 12pt; color: #000000;">(Ký, ghi rõ họ tên & đóng dấu)</em>
        <br/><br/><br/><br/><br/>
        <strong style="color: #000000; font-size: 12pt;">{{TEN_CONG_TY}}</strong>
      </td>
    </tr>
  </table>
</div>`,
  },
];
