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

## Cách chạy

Từ thư mục gốc repo, tạo môi trường ảo và cài dependency:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Đặt `USE_MOCK=0` để dùng model ONNX thật. Có thể đặt `MODEL_PATH` nếu model không nằm ở `models/waste_yolov8_int8.onnx`. PowerShell:

```powershell
$env:USE_MOCK = "0"
# Tùy chọn: $env:MODEL_PATH = "models/waste_yolov8_int8.onnx"
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Mở frontend tại `http://localhost:8000/`.
