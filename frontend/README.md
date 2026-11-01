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

Mở `http://localhost:5500`. Không cần thư viện frontend bên ngoài. Camera cần localhost hoặc HTTPS; trên điện thoại hãy dùng HTTPS và cập nhật `API_URL` trong `app.js` tới địa chỉ backend truy cập được.
