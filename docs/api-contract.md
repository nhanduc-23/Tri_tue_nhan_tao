# Hợp đồng API v0.1 (DRAFT, cả nhóm cần chốt)

## Endpoint

- `GET /health` trả `{"status":"ok"}`.
- `POST /detect` nhận `multipart/form-data`, field `file`, ảnh JPEG/PNG tối đa 5 MB. Frontend nên resize cạnh dài tối đa 640 px.

## Thành công

HTTP 200:

```json
{
  "image_width": 640,
  "image_height": 480,
  "inference_ms": 42,
  "detections": [
    {
      "class": "plastic_bottle",
      "class_vi": "Chai nhựa",
      "confidence": 0.91,
      "bbox": [10, 20, 100, 200],
      "bin_group": "recyclable",
      "bin_color": "yellow",
      "instruction": "..."
    }
  ]
}
```

`bbox` có dạng `[x1, y1, x2, y2]`, đơn vị pixel theo ảnh được gửi lên, gốc `(0, 0)` ở góc trên trái. Không phát hiện thì `detections` là `[]`. `confidence` nằm trong khoảng 0..1; chỉ giữ kết quả có confidence >= 0.4.

## Lỗi

| HTTP | Nội dung |
|---|---|
| 400 | `{"error":"invalid_image"}` |
| 413 | Ảnh vượt quá 5 MB |
| 500 | `{"error":"inference_failed"}` |

## Nhãn và phân loại dự kiến

Tên nhãn dùng `snake_case`, không dấu; phải trùng tuyệt đối ở dataset, `backend/rules.json` và frontend.

`plastic_bottle`, `metal_can`, `paper_carton`, `paper`, `plastic_bag`, `styrofoam`, `battery`, `food_waste`, `glass_bottle`.

`bin_group`: `recyclable`, `organic`, `residual`, `hazardous`.

Màu thùng: TODO xác nhận theo quy định địa phương.

## Hợp đồng nội bộ

TV3 cung cấp `run_inference(image_bytes) -> list[dict]` trong `backend/inference.py`; mỗi dict có `class`, `confidence`, `bbox`. TV4 bổ sung `class_vi`, `bin_group`, `bin_color`, `instruction` từ `backend/rules.json`.

## Lịch sử thay đổi

| Ngày | Người sửa | Nội dung |
|---|---|---|
| | | |
