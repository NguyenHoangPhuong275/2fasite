# 2fasite

Ứng dụng web tạo mã TOTP (2FA) chạy trên trình duyệt.

## Cấu trúc file

- `index.html`: giao diện và các thẻ tải tài nguyên.
- `style.css`: toàn bộ CSS.
- `script.js`: xử lý nhập chuỗi 2FA, sinh mã TOTP, countdown, copy mã, đồng bộ thời gian.

## Hành vi hiện tại

- Chấp nhận 2 kiểu input:
  - `otpauth://...` URI.
  - Secret Base32 (regex: `^[A-Z2-7]+=*$` sau khi bỏ khoảng trắng và upper-case).
- Sinh mã TOTP với cấu hình mặc định khi nhập Base32 thường:
  - Algorithm: `SHA1`
  - Digits: `6`
  - Period: `30s`
- Bấm nút submit hoặc nhấn `Enter` để xử lý input.
- Bấm vào khu vực mã để copy qua Clipboard API.
- Có vòng countdown + progress bar.
- Có state cảnh báo:
  - `state-warning` khi còn <= `7s`
  - `state-danger` khi còn <= `3s`

## Đồng bộ thời gian

Logic trong `script.js`:

1. Thử gọi `GET /api/time` (same-origin).
2. Nếu lỗi thì fallback sang `https://www.timeapi.io/api/Time/current/zone?timeZone=UTC`.
3. Chu kỳ đồng bộ lại: `5` phút.
4. Timeout mỗi lần gọi: `3500ms`.

`/api/time` được chấp nhận nếu trả về JSON có một trong các trường:

- `serverTime`
- `now`
- `timestamp`

Giá trị phải parse được thành số timestamp hợp lệ.

## Cách chạy

1. Mở `index.html` bằng trình duyệt.
2. Nhập chuỗi 2FA.
3. Bấm submit (hoặc Enter) để hiện mã.
