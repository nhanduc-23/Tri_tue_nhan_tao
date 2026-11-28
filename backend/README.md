# Backend

Phụ trách: TV4 (API) phối hợp TV3 (inference và logic AI).

Chứa API FastAPI, cấu hình quy tắc phân loại và điểm tích hợp inference. Chỉ người phụ trách sửa; người khác cần sửa thì nhắn.

## Chạy backend (PowerShell)

Từ thư mục `backend`, tạo môi trường và cài dependencies:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Chạy API trên cổng `8000`:

```powershell
$env:USE_MOCK = "1"
backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --reload --port 8000
```

`USE_MOCK=1` (mặc định) dùng dữ liệu mô phỏng. Đặt `$env:USE_MOCK = "0"` để gọi `run_inference()` thật. API và frontend cùng được phục vụ trên cổng `8000`.

## Mở trên điện thoại qua tunnel HTTPS

1. Cài Cloudflare Tunnel bằng PowerShell: `winget install Cloudflare.cloudflared`.
2. Trong cửa sổ PowerShell thứ nhất, tại `backend/`, chạy server: `uvicorn main:app --host 0.0.0.0 --port 8000`.
3. Trong cửa sổ thứ hai, chạy tunnel: `cloudflared tunnel --url http://localhost:8000`.
4. Mở link HTTPS do cloudflared in ra trên điện thoại; trang, API và camera dùng chung link.

Link tunnel là công khai; chỉ bật khi test và tắt ngay khi xong.

## Model và trạng thái health

- `USE_MOCK=1` là mặc định, API dùng mock. Đặt `$env:USE_MOCK = "0"` để chuyển sang đường inference của model.
- `MODEL_PATH` chỉ định file model; mặc định là `../models/best.onnx` (đường dẫn tương đối được tính từ thư mục `backend/`). Backend chỉ kiểm tra file có tồn tại, không load model; việc load thuộc `backend/inference.py` của TV3.
- `GET /health` trả `status`, `mode`, `model_path`, `model_found`. Khi mock đang bật, status là `ok`; khi `USE_MOCK=0` nhưng không tìm thấy model, status là `degraded`. `/detect` khi đó trả HTTP 500 `{"error":"inference_failed"}`.
