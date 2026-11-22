# Tri_tue_nhan_tao - Smart Waste Sorter & Tracker

Hệ thống AI nhận diện và phân loại rác thải theo thời gian thực sử dụng mô hình **YOLOv8n**.

## Cấu trúc thư mục dự án

```text
TRI_TUE_NHAN_TAO/
├── models/                           # Chứa file mô hình AI dùng để chạy
│   ├── best.pt                       # Bản 6.2MB mới nhất có nylon bag
│   └── waste_yolov8_int8.onnx        # File đã nén INT8 bàn giao cho backend
├── ai_core/                          # Code xử lý AI
│   ├── export_onnx.py                # Script nén best.pt -> waste_yolov8_int8.onnx
│   └── inference.py                  # Module nhận diện + bộ lọc chống nhận nhầm
├── training_logs/                    # Kết quả và biểu đồ huấn luyện mô hình
│   ├── args.yaml
│   ├── results.csv
│   ├── results.png
│   ├── BoxF1_curve.png
│   ├── BoxP_curve.png
│   ├── BoxPR_curve.png
│   ├── BoxR_curve.png
│   ├── confusion_matrix.png
│   ├── confusion_matrix_normalized.png
│   ├── labels.jpg
│   └── batch_samples/                # Chứa 12 ảnh train_batch*.jpg và val_batch*.jpg
├── backend/                          # Phần code FastAPI + SQLite + rules.json
├── frontend/                         # Phần code giao diện Camera Live
├── requirements.txt                  # Danh sách thư viện cần cài
└── README.md                         # Hướng dẫn cài đặt và chạy dự án
```
