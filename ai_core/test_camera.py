import cv2
from inference import SmartWasteDetector

detector = SmartWasteDetector(conf_thres=0.52)

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
if not cap.isOpened():
    print("[!] Không mở được camera index 0, đang thử index 1...")
    cap = cv2.VideoCapture(1, cv2.CAP_DSHOW)

cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
print("Đang chạy test ONNX INT8... Nhấn phím 'q' để thoát.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    output = detector.predict(frame, use_temporal_filter=True)

    for det in output["detections"]:
        x1, y1, x2, y2 = det["bbox"]
        text = f"{det['label']} ({det['confidence']:.2f})"
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    cv2.putText(frame, f"Latency: {output['inference_time_ms']} ms", (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

    cv2.imshow("Test ONNX INT8 - Smart Waste Sorter", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()