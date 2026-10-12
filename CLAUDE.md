# CLAUDE.md – App chấm công thợ hồ

Trả lời và viết giao diện bằng **tiếng Việt**. Hỏi chủ dự án trước khi đổi công nghệ hoặc cấu trúc dữ liệu.

## Mục đích
App web chạy trên điện thoại ở công trường. **Anh cai / trưởng nhóm chấm công cho cả đội** trên một máy.
Giao diện chữ to, nút to, ít bấm.

## Công nghệ (đã chốt)
- Web app tĩnh: HTML + CSS + JavaScript thuần, **không framework, không bước build, không thư viện ngoài**.
- Dữ liệu lưu trong trình duyệt (`localStorage`), **không có máy chủ** (chủ dự án chọn ngày 12/10/2026).
- Chạy được khi mất mạng nhờ service worker (`sw.js`); cài lên màn hình chính nhờ `manifest.webmanifest`.
- Sao lưu / khôi phục bằng file JSON (mục Quản lý).

## Các file
| File | Nội dung |
|---|---|
| `index.html` | Khung trang, thanh tab dưới cùng |
| `style.css` | Giao diện (màu chủ đạo cam gạch `#c2410c`) |
| `app.js` | Toàn bộ logic: dữ liệu, 4 màn hình, tính lương, xuất Excel |
| `xlsx.js` | Tự tạo file `.xlsx` (zip không nén + XML), không cần thư viện |
| `sw.js` | Lưu sẵn file để chạy offline. **Đổi `CACHE` khi thêm/đổi tên file** |
| `manifest.webmanifest`, `icon.svg` | Cài như app |

## Cấu trúc dữ liệu (`localStorage` khóa `chamcong_thoho_v1`)
```js
{
  version: 1,
  workers: [{ id, name, phone, rate /*đ/ngày*/, otRate /*đ/giờ, 0 = rate/8*/, active }],
  sites:   [{ id, name, address, active }],
  att:     { "YYYY-MM-DD|workerId": { date, workerId, siteId, day /*1 | 0.5 | 0*/, ot /*giờ*/ } },
  adv:     [{ id, workerId, amount, date, note }],   // tiền ứng, không gắn công trình
  ui:      { siteId }                                 // công trình đang chọn
}
```
- Mỗi thợ mỗi ngày chỉ có **một** bản ghi chấm công (một công trình).
- Thợ / công trình không xóa hẳn, chỉ tắt `active` để giữ lịch sử.

## Cách tính
- Tiền công = `day × rate + ot × otRate` (otRate trống thì = rate ÷ 8).
- Còn lại = tiền công − tiền ứng trong cùng khoảng ngày.
- Tuần tính từ **thứ hai đến chủ nhật**. Ngày dùng giờ máy, dạng chuỗi `YYYY-MM-DD`.
- Lọc theo công trình: tiền ứng vẫn tính chung (vì ứng không gắn công trình).

## Màn hình
1. **Chấm công** – chọn ngày, công trình; Cả ngày / Nửa ngày / Nghỉ; tăng ca ± 0,5 giờ; nút "Cả đội đi làm".
2. **Ứng tiền** – ghi khoản ứng, nút nhanh 200k / 500k / 1 triệu, xóa khoản ứng.
3. **Bảng lương** – tuần này / tuần trước / tháng này / tháng trước / tự chọn, lọc công trình, xem chi tiết từng thợ, xuất Excel (3 trang: Bảng lương, Bảng công, Tiền ứng).
4. **Quản lý** – thợ, công trình, sao lưu / khôi phục.

## Kiểm thử
Chạy `python3 -m http.server 8000` rồi mở bằng trình duyệt ở khung điện thoại (390px).
Trong console có `window.__app.payroll(from, to, siteId)` để kiểm tra số liệu.

## Ghi nhớ
Cập nhật `MEMORY.md` sau mỗi lần làm xong một việc.
