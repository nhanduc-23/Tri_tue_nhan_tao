from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
RULES_PATH = BASE_DIR / "rules.json"
FRONTEND_DIR = ROOT_DIR / "frontend"
MODEL_PATH = os.getenv("MODEL_PATH", "models/waste_yolov8_int8.onnx")
USE_MOCK = os.getenv("USE_MOCK", "1").strip().lower() not in {"0", "false", "no"}

with RULES_PATH.open("r", encoding="utf-8") as f:
    RULES: dict[str, dict[str, Any]] = json.load(f)

ALIASES: dict[str, str] = {}
for canonical, rule in RULES.items():
    ALIASES[canonical] = canonical
    for alias in rule.get("aliases", []):
        ALIASES[alias] = canonical

app = FastAPI(title="Smart Waste Sorter API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_detector: Any | None = None
_detector_lock = threading.Lock()


def _get_detector() -> Any:
    global _detector
    if _detector is None:
        with _detector_lock:
            if _detector is None:
                # Import only when real inference is enabled; use the shared TV2/TV3 implementation.
                from ai_core.inference import SmartWasteDetector

                model_path = Path(MODEL_PATH)
                if not model_path.is_absolute():
                    model_path = ROOT_DIR / model_path
                _detector = SmartWasteDetector(model_path=str(model_path))
    return _detector


def _mock_inference(image_bgr: np.ndarray) -> dict[str, Any]:
    height, width = image_bgr.shape[:2]
    return {
        "detections": [
            {
                "class_id": 0,
                "label": "plastic_bottle",
                "confidence": 0.91,
                "bbox": [round(width * 0.2), round(height * 0.2), round(width * 0.8), round(height * 0.8)],
            }
        ],
        "inference_time_ms": 0.0,
    }


@app.get("/health")
def health() -> dict[str, Any]:
    model_file = Path(MODEL_PATH)
    if not model_file.is_absolute():
        model_file = ROOT_DIR / model_file
    return {
        "status": "ok",
        "mode": "mock" if USE_MOCK else "onnx",
        "model_path": str(model_file),
        "model_found": model_file.is_file(),
    }


@app.post("/detect", response_model=None)
async def detect(file: UploadFile = File(...)) -> JSONResponse | dict[str, Any]:
    try:
        content = await file.read()
        image_bgr = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image_bgr is None:
            return JSONResponse(status_code=400, content={"error": "invalid_image"})

        if USE_MOCK:
            result = _mock_inference(image_bgr)
        else:
            result = _get_detector().predict(image_bgr, use_temporal_filter=False)

        height, width = image_bgr.shape[:2]
        detections = []
        for detection in result.get("detections", []):
            raw_label = str(detection.get("label", "unknown"))
            canonical = ALIASES.get(raw_label, raw_label)
            rule = RULES.get(canonical, {})
            detections.append(
                {
                    "class": canonical,
                    "class_vi": rule.get("class_vi", raw_label),
                    "confidence": float(detection.get("confidence", 0.0)),
                    "bbox": detection.get("bbox", [0, 0, width, height]),
                    "bin_group": rule.get("bin_group", "other"),
                    "bin_color": rule.get("bin_color", "gray"),
                    "instruction": rule.get("instruction", "Chưa có hướng dẫn cho nhãn này."),
                }
            )
        return {
            "detections": detections,
            "image_width": int(width),
            "image_height": int(height),
            "inference_ms": float(result.get("inference_time_ms", 0.0)),
        }
    except Exception:
        return JSONResponse(status_code=500, content={"error": "inference_failed"})
    finally:
        await file.close()


if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
