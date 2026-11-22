from pathlib import Path
import time
from collections import deque, Counter
import cv2
import numpy as np
import onnxruntime as ort

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = ROOT_DIR / "models" / "waste_yolov8_int8.onnx"

class SmartWasteDetector:
    def __init__(self, model_path=None, conf_thres=0.52, iou_thres=0.45):
        target_path = str(model_path or DEFAULT_MODEL_PATH)
        self.session = ort.InferenceSession(target_path, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.conf_thres = conf_thres
        self.iou_thres = iou_thres

        self.class_names = {
            0: "plastic_bottle",
            1: "can",
            2: "cardboard",
            3: "nylon-bag"
        }
        self.frame_history = deque(maxlen=5)

    def preprocess(self, image_bgr):
        orig_h, orig_w = image_bgr.shape[:2]
        img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, (640, 640))
        img_norm = img_resized.astype(np.float32) / 255.0
        img_chw = np.transpose(img_norm, (2, 0, 1))
        return np.expand_dims(img_chw, axis=0), orig_w, orig_h

    def predict(self, image_bgr, use_temporal_filter=True):
        t0 = time.perf_counter()
        input_tensor, orig_w, orig_h = self.preprocess(image_bgr)
        frame_area = orig_w * orig_h
        outputs = self.session.run(None, {self.input_name: input_tensor})[0]

        predictions = np.squeeze(outputs).T
        scores = np.max(predictions[:, 4:], axis=1)
        keep = scores > self.conf_thres
        predictions = predictions[keep]
        scores = scores[keep]
        class_ids = np.argmax(predictions[:, 4:], axis=1)

        boxes, valid_scores, valid_cids = [], [], []
        for box, score, cid in zip(predictions[:, :4], scores, class_ids):
            xc, yc, w, h = box
            x1 = max(0, int((xc - w / 2) * orig_w / 640))
            y1 = max(0, int((yc - h / 2) * orig_h / 640))
            bw = int(w * orig_w / 640)
            bh = int(h * orig_h / 640)

            area_ratio = (bw * bh) / frame_area
            if 0.015 <= area_ratio <= 0.85:
                boxes.append([x1, y1, bw, bh])
                valid_scores.append(float(score))
                valid_cids.append(int(cid))

        indices = cv2.dnn.NMSBoxes(boxes, valid_scores, self.conf_thres, self.iou_thres)
        raw_detections = []
        current_labels = set()

        if len(indices) > 0:
            for i in indices.flatten():
                x, y, w, h = boxes[i]
                cid = valid_cids[i]
                label = self.class_names.get(cid, "unknown")
                current_labels.add(label)
                raw_detections.append({
                    "class_id": cid,
                    "label": label,
                    "confidence": round(valid_scores[i], 3),
                    "bbox": [x, y, x + w, y + h]
                })

        if use_temporal_filter:
            self.frame_history.append(current_labels)
            label_counts = Counter(lbl for frame_lbls in self.frame_history for lbl in frame_lbls)
            min_hits = min(3, len(self.frame_history))
            confirmed_detections = [
                d for d in raw_detections if label_counts[d["label"]] >= min_hits
            ]
        else:
            confirmed_detections = raw_detections

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {"detections": confirmed_detections, "inference_time_ms": latency_ms}