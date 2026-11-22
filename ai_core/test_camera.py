from pathlib import Path
import cv2
from ultralytics import YOLO

# 1. Nạp mô hình đã train từ thư mục models/
ROOT_DIR = Path(__file__).resolve().parent.parent
model_path = ROOT_DIR / "models" / "best.pt"
model = YOLO(str(model_path))

# 2. Mở camera với backend DirectShow trên Windows
# Thử index 0 trước, nếu vẫn đen hãy đổi sang index 1
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

# Kiểm tra xem camera có mở được không
if not cap.isOpened():
    print("[!] Không mở được camera với index 0, đang thử index 1...")
    cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)

# Đặt kích thước khung hình
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

print("Đang khởi động camera... Nhấn phím 'q' trên cửa sổ để thoát.")

while cap.isOpened():
    success, frame = cap.read()
    if not success or frame is None:
        print("Không đọc được khung hình từ camera.")
        break

    # Chạy suy luận với ngưỡng tin cậy conf=0.4
    results = model.predict(source=frame, conf=0.4, verbose=False)

    # Vẽ bounding box lên khung hình
    annotated_frame = results[0].plot()

    # Hiển thị cửa sổ
    cv2.imshow("Nhan dien rac - YOLOv8 Realtime", annotated_frame)

    # Bấm phím 'q' để dừng
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()