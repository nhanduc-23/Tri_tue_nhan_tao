# Smart Waste Sorter & Tracker

Ứng dụng thử nghiệm phân loại rác qua camera. Backend hiện trả kết quả mock; chưa có model YOLO/ONNX. Hướng dẫn trong `backend/rules.json` là gợi ý chung và cần đối chiếu quy định, màu thùng, điểm thu gom tại địa phương.

## Cài đặt

Yêu cầu Python 3.10 trở lên. Trong PowerShell, tại thư mục dự án:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
```

## Chạy backend

```powershell
cd backend
..\.venv\Scripts\python -m uvicorn main:app --reload --port 8000
```

API: `http://localhost:8000/health`, tài liệu tương tác: `http://localhost:8000/docs`.

## Mở frontend

Mở `frontend/index.html` trực tiếp trong trình duyệt trên máy tính. Nếu trình duyệt hạn chế camera với file URL, phục vụ thư mục `frontend` bằng một web server tĩnh miễn phí, ví dụ `python -m http.server 5500 --directory frontend`, rồi mở `http://localhost:5500`.

## Thử trên điện thoại

Camera trên điện thoại cần HTTPS hoặc localhost. Chạy backend và frontend trên máy phát triển, sau đó dùng Cloudflare Tunnel hoặc ngrok (có thể có giới hạn gói miễn phí) để tạo HTTPS URL. Cập nhật `API_URL` trong `frontend/app.js` thành URL backend có thể truy cập từ điện thoại; mở URL HTTPS của frontend. Không đưa dữ liệu nhạy cảm lên tunnel công khai.

