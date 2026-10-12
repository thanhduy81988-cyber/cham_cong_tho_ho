# CLAUDE.md – App chấm công thợ hồ

Trả lời và viết giao diện bằng **tiếng Việt**. Hỏi chủ dự án trước khi đổi công nghệ hoặc cấu trúc dữ liệu.

## Mục đích
App web chạy trên điện thoại ở công trường. **Anh cai / trưởng nhóm chấm công cho cả đội** trên một máy.
Giao diện chữ to, nút to, ít bấm. Bản 2 (12/10/2026) làm theo **ảnh app mẫu chủ dự án gửi** (xem `/mnt/project-files/cham-cong/app-mau-tham-khao.md`), đồ họa làm lại cho đẹp.

## Công nghệ (đã chốt)
- Web app tĩnh: HTML + CSS + JavaScript thuần, **không framework, không bước build, không thư viện ngoài**.
- Dữ liệu lưu trong trình duyệt (`localStorage`), **không có máy chủ** (chủ dự án chọn ngày 12/10/2026).
  Vì vậy bỏ các tính năng cần máy chủ của app mẫu: thợ tự chấm, vào nhóm bằng QR, trợ lý, thông báo.
- Chạy được khi mất mạng nhờ service worker (`sw.js`); cài lên màn hình chính nhờ `manifest.webmanifest`.
- Sao lưu / khôi phục bằng file JSON (màn Cá nhân), nhận cả file của bản 1.

## Các file
| File | Nội dung |
|---|---|
| `index.html` | Khung trang: `#app`, `#toast`, `<dialog id="sheet">` (bảng trượt từ dưới lên) |
| `style.css` | Giao diện (màu chủ đạo xanh `#2563eb`, nền `#eef3f8`, cam `#f59e0b` cho nút chấm cả đội) |
| `app.js` | Toàn bộ logic: dữ liệu, chuyển bản 1 → 2, các màn hình (router `#/...`), tính lương, xuất Excel |
| `lunar.js` | Đổi ngày dương sang âm lịch (thuật toán Hồ Ngọc Đức), hiện ở trang chủ |
| `xlsx.js` | Tự tạo file `.xlsx` (zip không nén + XML), không cần thư viện |
| `sw.js` | Lưu sẵn file để chạy offline. **Đổi `CACHE` khi thêm/đổi file** (đang là `chamcong-v3`) |
| `manifest.webmanifest`, `icon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Cài như app (iPhone cần icon PNG 180px) |

## iPhone (ưu tiên số 1)
- Chạy bằng Safari, cài bằng **Chia sẻ → Thêm vào MH chính**. App hiện hướng dẫn này khi mở trong Safari (ẩn bằng `ui.hideInstall`).
- Safari xóa `localStorage` của trang không mở trong 7 ngày, **trừ khi đã thêm vào màn hình chính**; app gọi thêm `navigator.storage.persist()`.
- Xuất Excel / sao lưu trên iPhone dùng `navigator.share` (bảng Chia sẻ: Lưu vào Tệp, Zalo...), máy khác tải file như thường.
- Chữ trong ô nhập ≥ 16px để Safari không tự phóng to.

## Cấu trúc dữ liệu (`localStorage` khóa `chamcong_thoho_v2`)
```js
{
  version: 2, owner,                                   // owner: tên hiện ở "Xin chào ..."
  jobs:    [{ id, name, status /*'active'|'done'*/, createdAt,
              members: [{ workerId, rate /*đ/ngày*/, otRate /*đ/giờ, 0 = rate/8*/, joinedAt, active }] }],
  workers: [{ id, name, position, phone, createdAt }], // danh bạ thợ dùng chung; lương nằm ở members
  att:     { "jobId|workerId|YYYY-MM-DD": 1 | 0.5 | 'P' },   // 'P' = nghỉ có lương
  money:   [{ id, jobId, workerId, type /*'adv'|'ot'|'bonus'|'deduct'|'pay'*/, amount, hours?, date, note }],
  income:  [{ id, jobId, date, amount, source, note }],      // tiền chủ nhà trả (Lợi nhuận)
  expense: [{ id, jobId, date, amount, source, note }],      // chi khác của công việc
  ui:      { showMoney, hideInstall }
}
```
- "Công việc" (job) = một công trình. Mỗi thợ có lương riêng theo từng công việc.
- Thợ nghỉ việc chỉ tắt `active` trong công việc (tab Đã nghỉ); "Xóa vĩnh viễn" mới xóa hẳn.
- Có dữ liệu bản 1 (khóa `chamcong_thoho_v1`) thì `migrateV1()` tự chuyển: công trình → công việc, giờ tăng ca → khoản `ot`, tiền ứng gắn vào công việc gần nhất của thợ.

## Cách tính (`statOf` trong `app.js`)
- Tiền công = (số công + ngày nghỉ có lương) × lương ngày.
- Tổng lương = tiền công + tăng ca + phụ cấp.
- Chưa thanh toán = tổng lương − đã ứng − trừ tiền − đã thanh toán.
- Tăng ca nhập theo giờ thì tiền = giờ × otRate (trống thì = lương ngày ÷ 8), hoặc nhập thẳng tiền.
- Nút "Thanh toán lương" ở Bảng lương ghi khoản `pay` bằng số chưa thanh toán của từng thợ.
- Lợi nhuận = thu vào − (tổng lương − trừ tiền) − chi khác.
- Ngày dùng giờ máy, dạng chuỗi `YYYY-MM-DD`. Lịch tuần bắt đầu thứ hai.

## Màn hình (router theo `location.hash`)
- `#/` Trang chủ: lời chào, ngày dương + âm, tìm kiếm, thẻ từng công việc (ngày chốt lương cuối tháng, số thợ, đã ứng tháng này), nút + tạo công việc.
- `#/job/ID` Chi tiết công việc: tổng chưa thanh toán (che/hiện), lối tắt Lợi nhuận / Nhân viên / Xuất Excel / Xem thêm; tab **Chấm công** (thẻ từng thợ, nút 1/2 công, cả công, Khác; nút cam chấm cả đội) và **Tổng quan** (lịch tháng tiền công từng ngày).
- `#/job/ID/w/WID` Một thợ: Ứng lương, Tăng ca, Phụ cấp, Trừ tiền, Thanh toán, Xuất Excel, Chấm nhanh, Tạm ngừng; tổng tháng; lịch 1 / ½ / P.
- `.../money/TYPE` danh sách ứng / tăng ca / phụ cấp / trừ tiền / thanh toán theo tháng.
- `.../staff` quản lý nhân viên (Đang làm / Đã nghỉ), `.../pick` thêm thợ có sẵn, `.../overview` tổng quan theo khoảng ngày, `.../payroll` bảng lương tháng, `.../slip/WID` phiếu lương, `.../export` xuất Excel, `.../profit` lợi nhuận.
- `#/me` Cá nhân: tên, sao lưu / khôi phục, danh bạ thợ, hướng dẫn.

## Kiểm thử
Chạy `python3 -m http.server 8000` rồi mở bằng trình duyệt ở khung điện thoại (390px).
Trong console có `window.__app` (`statOf`, `jobStats`, `db`, `migrateV1`) để kiểm tra số liệu.

## Ghi nhớ
Cập nhật `MEMORY.md` sau mỗi lần làm xong một việc.
