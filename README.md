# 2fasite

Ứng dụng web tạo mã TOTP (2FA) và đọc mail Outlook phục vụ lấy mã xác thực.

## Cấu trúc chính

- `index.html`: giao diện chính.
- `src/css/style.css`: toàn bộ CSS.
- `src/js/script.js`: bootstrap app.
- `src/js/otp/*`: logic tạo mã TOTP, đồng bộ thời gian, render UI 2FA.
- `src/js/ui/contact-modal.js`: modal liên hệ.
- `src/js/ui/outlook-modal.js`: luồng đọc mail Outlook.
- `api/token.js`: serverless endpoint đổi `refresh_token` sang `access_token`.

## Luồng 2FA

- Hỗ trợ input `otpauth://...` hoặc secret Base32.
- Tạo mã TOTP mặc định `SHA1`, `6 digits`, `30s` khi nhập Base32 thường.
- Có countdown + progress bar và copy mã bằng Clipboard API.
- Đồng bộ thời gian qua `/api/time`, fallback `timeapi.io`.

## Luồng Outlook

- Nhập dữ liệu theo dạng ưu tiên:
  - `email|password|refresh_token|device_id`
  - hoặc `email|refresh_token|device_id`
  - hoặc `refresh_token|device_id`
- App gọi `/api/token` để lấy access token.
- App đọc danh sách thư từ Outlook API, fallback sang Microsoft Graph API.
- Click từng dòng thư để mở chi tiết trong modal.

## Chạy local

```bash
npx vercel dev
```

Mở địa chỉ local do Vercel CLI cung cấp.
