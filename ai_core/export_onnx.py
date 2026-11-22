import os
from ultralytics import YOLO
from onnxruntime.quantization import quantize_dynamic, QuantType

print("1. Đang tải mô hình gốc từ models/best.pt...")
pt_path = "models/best.pt"
if not os.path.exists(pt_path):
    raise FileNotFoundError(f"Không tìm thấy {pt_path}. Hãy kiểm tra lại thư mục models/!")

model = YOLO(pt_path)
print("Danh sách nhãn trong mô hình:", model.names)

print("2. Đang xuất sang định dạng ONNX FP32...")
onnx_fp32_path = model.export(format="onnx", imgsz=640, simplify=True, opset=12)

print("3. Đang nén Quantization INT8...")
onnx_int8_path = "models/waste_yolov8_int8.onnx"
quantize_dynamic(
    model_input=onnx_fp32_path,
    model_output=onnx_int8_path,
    weight_type=QuantType.QUInt8
)

print("--- HOÀN TẤT ---")
print(f"Dung lượng .pt gốc:   {os.path.getsize(pt_path) / (1024 * 1024):.2f} MB")
print(f"Dung lượng ONNX FP32: {os.path.getsize(onnx_fp32_path) / (1024 * 1024):.2f} MB")
print(f"Dung lượng ONNX INT8: {os.path.getsize(onnx_int8_path) / (1024 * 1024):.2f} MB")