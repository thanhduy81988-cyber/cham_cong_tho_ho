# Chấm công thợ hồ

App web chạy trên điện thoại để anh cai / trưởng nhóm chấm công cho cả đội ở công trường.

## Làm được gì
- **Chấm công**: chọn ngày và công trình, bấm *Cả ngày / Nửa ngày / Nghỉ* cho từng thợ, nút **+ / −** để ghi giờ tăng ca (mỗi lần 0,5 giờ). Nút *Cả đội đi làm* chấm cả ngày cho mọi thợ chưa chấm. Bấm lại nút đang chọn để bỏ chấm.
- **Ứng tiền**: ghi số tiền thợ ứng, có nút nhanh 200 nghìn / 500 nghìn / 1 triệu.
- **Bảng lương**: theo tuần này, tuần trước, tháng này, tháng trước hoặc tự chọn ngày; lọc theo công trình. Tiền công = số công × đơn giá + giờ tăng ca × tiền tăng ca/giờ, trừ tiền ứng ra số còn phải trả. Bấm vào tên thợ để xem từng ngày.
- **Xuất Excel** (.xlsx) gồm 3 trang: Bảng lương, Bảng công (theo từng ngày), Tiền ứng.
- **Quản lý**: danh sách thợ (tiền công/ngày, tiền tăng ca/giờ – để trống thì tính bằng tiền ngày ÷ 8), nhiều công trình, sao lưu / khôi phục dữ liệu bằng file.

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
