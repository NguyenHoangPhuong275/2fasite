# 2fasite

Ung dung web tao ma TOTP (2FA) chay tren trinh duyet.

## Cau truc file

- `index.html`: giao dien va cac the tai tai nguyen.
- `style.css`: toan bo CSS.
- `script.js`: xu ly nhap chuoi 2FA, sinh ma TOTP, countdown, copy ma, dong bo thoi gian.

## Hanh vi hien tai

- Chap nhan 2 kieu input:
  - `otpauth://...` URI.
  - Secret Base32 (regex: `^[A-Z2-7]+=*$` sau khi bo khoang trang va upper-case).
- Sinh ma TOTP voi cau hinh mac dinh khi nhap Base32 thuong:
  - Algorithm: `SHA1`
  - Digits: `6`
  - Period: `30s`
- Bam nut submit hoac nhan `Enter` de xu ly input.
- Bam vao khu vuc ma de copy qua Clipboard API.
- Co vong countdown + progress bar.
- Co state canh bao:
  - `state-warning` khi con <= `7s`
  - `state-danger` khi con <= `3s`

## Dong bo thoi gian

Logic trong `script.js`:

1. Thu goi `GET /api/time` (same-origin).
2. Neu loi thi fallback sang `https://www.timeapi.io/api/Time/current/zone?timeZone=UTC`.
3. Chu ky dong bo lai: `5` phut.
4. Timeout moi lan goi: `3500ms`.

`/api/time` duoc chap nhan neu tra ve JSON co mot trong cac truong:

- `serverTime`
- `now`
- `timestamp`

Gia tri phai parse duoc thanh so timestamp hop le.

## Cach chay

1. Mo `index.html` bang trinh duyet.
2. Nhap chuoi 2FA.
3. Bam submit (hoac Enter) de hien ma.

## Phu thuoc runtime

- `otpauth` UMD tai tu CDN: `https://cdn.jsdelivr.net/npm/otpauth@9.5.0/dist/otpauth.umd.min.js`
- Google Fonts (Inter, JetBrains Mono).

Neu khong tai duoc CDN thi ung dung khong sinh ma TOTP.
