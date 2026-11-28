# Frontend

Phụ trách: TV4.

Chứa giao diện web/PWA và phần gọi API. Chỉ người phụ trách sửa; người khác cần sửa thì nhắn.

## Chạy trên máy tính

Chạy backend từ thư mục `backend/` bằng `uvicorn main:app --host 0.0.0.0 --port 8000`, rồi mở `http://localhost:8000`. Backend phục vụ giao diện và API cùng một cổng.

## Mở trên điện thoại qua tunnel HTTPS

1. Cài Cloudflare Tunnel bằng PowerShell: `winget install Cloudflare.cloudflared`.
2. Trong PowerShell thứ nhất, tại `backend/`, chạy `uvicorn main:app --host 0.0.0.0 --port 8000`.
3. Trong PowerShell thứ hai, chạy `cloudflared tunnel --url http://localhost:8000`.
4. Mở link HTTPS do cloudflared in ra trên điện thoại. Camera cần localhost hoặc HTTPS; trang gọi API bằng đường dẫn tương đối nên cùng dùng một link.

Link tunnel là công khai; chỉ bật khi test và tắt ngay khi xong.

## Frontend tĩnh riêng (tuỳ chọn)

Nếu chỉ cần mở giao diện tại máy tính, có thể phục vụ riêng trên cổng `5500`:

```powershell
python -m http.server 5500 --directory frontend
```

## PWA và icon

Tạo các icon PNG được manifest tham chiếu bằng Pillow (đã có trong môi trường backend):

```powershell
backend/.venv/Scripts/python.exe backend/tools/make_icons.py
```

Trên Chrome Android, mở ứng dụng qua HTTPS, chờ nút **Cài ứng dụng** nếu Chrome phát sự kiện cài đặt; hoặc mở menu Chrome (⋮) và chọn **Cài đặt ứng dụng** / **Thêm vào màn hình chính**.

Link HTTPS tạm của tunnel thường đổi sau mỗi lần chạy. PWA đã cài bằng link cũ sẽ không còn truy cập được khi link đổi; chỉ dùng PWA tunnel cho demo hoặc chụp ảnh báo cáo.

Service worker dùng cache `waste-static-v1`; khi sửa `sw.js`, hãy tăng số phiên bản trong `CACHE_NAME` để thiết bị cài ứng dụng nhận cache mới. Các request `/detect` và `/health` luôn đi tới server, không cache.

## Theo dõi phiên và xuất dữ liệu

- Bảng thống kê hiển thị tên tiếng Việt, số lượng đã khử đếm lặp, màu thùng và tổng. Một nhãn được cộng theo phần tăng số detection giữa hai frame; nếu số lượng ổn định, nhãn đó được cộng tối đa một lần mỗi 3 giây.
- Thanh **Ngưỡng tin cậy** lọc kết quả trước khi vẽ và thống kê; mặc định là `0.50`.
- **Xóa thống kê** xóa bộ đếm và lịch sử trong phiên hiện tại. **Xuất CSV** tải lịch sử tối đa 1.000 dòng, có BOM UTF-8 để Excel đọc tiếng Việt.
- Dòng trạng thái đọc `mode` từ `/health` và hiển thị `inference_ms` mới nhất. Lịch sử CSV chỉ nằm trong bộ nhớ trình duyệt và mất khi tải lại trang.

Mở `http://localhost:5500`. Không cần thư viện frontend bên ngoài. Camera cần localhost hoặc HTTPS; trên điện thoại hãy dùng HTTPS và cập nhật `API_URL` trong `app.js` tới địa chỉ backend truy cập được.
