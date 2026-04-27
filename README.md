<div align="center">
  <img src="./assets/images/logo.png" alt="DOVIESHOP" width="112" />

  # DOVIESHOP

  **Website lấy mã 2FA, đọc Hotmail và hiển thị bảng giá tài khoản AI**

  <p>
    <img src="https://img.shields.io/badge/HTML-5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML 5" />
    <img src="https://img.shields.io/badge/CSS-3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS 3" />
    <img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111" alt="JavaScript ESM" />
    <img src="https://img.shields.io/badge/Vite-8.0.8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 8.0.8" />
    <img src="https://img.shields.io/badge/Vercel-Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Serverless" />
  </p>
</div>

---

## Giới thiệu

**DOVIESHOP** là web app frontend dùng Vite, có API serverless trên Vercel. Project hiện có các luồng chính: tạo mã TOTP/2FA từ secret, đọc thư Hotmail/Outlook qua Microsoft token và hiển thị bảng giá sản phẩm AI.

---

## Tính năng nổi bật

- **Lấy mã 2FA:** hỗ trợ `otpauth://...`, secret Base32 và chuỗi có nhãn `secret:`.
- **TOTP realtime:** dùng `otpauth@9.5.0`, hiển thị countdown, progress bar và sao chép mã bằng Clipboard API.
- **Đồng bộ thời gian:** gọi `/api/time`, fallback được xử lý trong module đồng bộ thời gian.
- **Đọc Hotmail/Outlook:** nhập refresh token và client id để lấy access token qua `/api/token`.
- **Danh sách thư:** đọc tối đa 12 thư mới qua Microsoft Graph hoặc Outlook API tùy scope token.
- **Tự nhận diện mã xác thực:** quét subject, preview và nội dung thư để tìm OTP/passcode/security code.
- **Bảng giá AI:** hiển thị các sản phẩm như ChatGPT Plus, Gemini AI Pro, CapCut Pro Team, SuperGrok, Veo 3 Ultra, Kling Pro và Antigravity Ultra.
- **Bảo vệ API:** có CORS theo origin tin cậy, kiểm tra browser request và rate limit cho endpoint token.

---

## Công nghệ

- **Frontend:** HTML, CSS, JavaScript ES Modules
- **Build tool:** Vite
- **UI dependency:** Bootstrap CSS qua CDN
- **OTP library:** `otpauth@9.5.0` qua CDN
- **API runtime:** Vercel Serverless Functions
- **Mail API:** Microsoft Graph `me/messages`, có nhánh tương thích Outlook API v2.0

---

## Cấu trúc project

```text
.
├── api/
│   ├── _security.js       # CORS, trusted request, rate limit
│   ├── time.js            # Trả thời gian server
│   └── token.js           # Đổi refresh_token sang access_token Microsoft
├── assets/images/         # Logo, favicon, hình sản phẩm
├── src/
│   ├── css/style.css      # Giao diện chính
│   └── js/
│       ├── otp/           # TOTP, đồng bộ thời gian, render OTP
│       ├── ui/            # Menu, modal, Outlook, bảng giá
│       ├── script.js      # Bootstrap app
│       └── telemetry.js   # Telemetry frontend
├── index.html             # Entry HTML
├── package.json
└── vercel.json            # Build, headers, CSP, cache policy
```

---

## Chạy local

Cài dependency:

```bash
npm install
```

Chạy đầy đủ frontend và API serverless:

```bash
npx vercel dev
```

Chạy frontend Vite:

```bash
npm run dev:frontend
```

Build production:

```bash
npm run build
```

---

## Biến môi trường

```env
MS_CLIENT_ID=<microsoft-client-id>
ALLOWED_ORIGINS=https://your-domain.example
```

- `MS_CLIENT_ID`: client id mặc định nếu dữ liệu dán vào luồng đọc mail không có `client_id`.
- `ALLOWED_ORIGINS`: danh sách origin được phép gọi API, phân tách bằng dấu phẩy.

---

## Định dạng dữ liệu đọc mail

Các dạng input được parser hiện tại hỗ trợ:

```text
email|password|refresh_token|client_id
email|refresh_token|client_id
refresh_token|client_id
client_id:<uuid> refresh_token:M....
device_id:<uuid> refresh_token:M....
```

`refresh_token` phải bắt đầu bằng `M.` và `client_id` phải là UUID hợp lệ.

---

## Ghi chú

- Project chưa có file license trong repo.
- Endpoint `/api/token` giới hạn 10 request/phút theo IP.
- Access token phía frontend được xoá khỏi state sau 5 phút.
