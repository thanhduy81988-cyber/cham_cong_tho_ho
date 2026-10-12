# Chấm công thợ hồ

App web chạy trên điện thoại để anh cai / trưởng nhóm chấm công cho cả đội ở công trường.

## Làm được gì
- **Trang chủ**: mỗi công việc (công trình) một thẻ: ngày chốt lương, số thợ, tiền đã ứng tháng này, nút *Chấm công* và *Xem chi tiết*. Hiện cả ngày âm lịch.
- **Chấm công**: thẻ từng thợ với nút *1/2 công*, *Chấm công* (cả ngày) và *Khác* (nghỉ có lương, bỏ chấm). Nút cam chấm cả đội một lần.
- **Từng thợ**: ứng lương, tăng ca, phụ cấp, trừ tiền, thanh toán; lịch tháng có đánh dấu 1 / ½ / P; phiếu lương.
- **Bảng lương tháng**: tổng lương, đã ứng, chưa thanh toán; nút *Thanh toán lương* ghi đã trả cho cả đội.
- **Tổng quan & Lợi nhuận**: theo tháng hoặc khoảng ngày; ghi tiền chủ nhà trả và chi khác để xem lãi.
- **Xuất Excel** (.xlsx): bảng chấm công, bảng lương, ứng / tăng ca / phụ cấp, phiếu lương từng thợ.
- **Nhân viên**: lương riêng theo từng công việc, tab Đang làm / Đã nghỉ. Sao lưu / khôi phục bằng file ở mục Cá nhân.

## Lưu dữ liệu
Không cần máy chủ: mọi dữ liệu nằm trong trình duyệt của điện thoại (localStorage). Vì vậy:
- Chỉ một máy chấm công (máy của anh cai).
- Nên bấm **Tải file sao lưu** thường xuyên; xóa dữ liệu trình duyệt sẽ mất dữ liệu.
- Mở được cả khi mất mạng sau lần mở đầu tiên. Có thể *Thêm vào màn hình chính* để dùng như app.

## Chạy thử
Mở `index.html` bằng trình duyệt, hoặc chạy một web server tĩnh bất kỳ trong thư mục này, ví dụ:

```
python3 -m http.server 8000
```

## Dùng trên iPhone
1. Bật **GitHub Pages** cho repo (Settings → Pages → Deploy from a branch → `main`, thư mục `/`).
2. Mở link `https://thanhduy81988-cyber.github.io/cham_cong_tho_ho/` bằng **Safari**.
3. Bấm **Chia sẻ** → **Thêm vào MH chính**. Từ đó mở app bằng biểu tượng trên màn hình, chạy cả khi mất mạng.

Nên mở từ màn hình chính: nếu chỉ mở trong Safari mà 7 ngày không dùng, iPhone có thể xóa dữ liệu.
File Excel và file sao lưu trên iPhone mở bằng bảng Chia sẻ: chọn *Lưu vào Tệp* hoặc gửi qua Zalo.
