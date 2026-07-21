# Ứng dụng TOTP/2FA

Ứng dụng web tối giản để tạo mã TOTP trực tiếp trên trình duyệt. Secret không được gửi lên server.

## Input hỗ trợ

- Secret Base32.
- URI `otpauth://totp/...`.
- Chuỗi có nhãn `secret:` hoặc `secret=`.

## Cách hoạt động

- Đồng bộ giờ qua `/api/time`, fallback sang đồng hồ hệ thống nếu API không khả dụng.
- Tạo mã bằng `otpauth`; nếu CDN không khả dụng, ứng dụng có fallback TOTP SHA-1 nội bộ.
- Hiển thị thời gian còn lại và cho phép sao chép mã.

## Chạy local

```bash
npm install
npx vercel dev
```

Chỉ chạy frontend:

```bash
npm run dev:frontend
```

Build production:

```bash
npm run build
```
