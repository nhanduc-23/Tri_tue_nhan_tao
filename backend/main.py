from __future__ import annotations

import json
import os
import time
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from inference import run_inference
from mock_inference import mock_inference

BASE_DIR = Path(__file__).resolve().parent
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG"}
DEFAULT_INSTRUCTION = "Bỏ vào nhóm rác còn lại và làm theo hướng dẫn phân loại tại địa phương."


def load_rules() -> dict[str, dict[str, str]]:
    with (BASE_DIR / "rules.json").open("r", encoding="utf-8") as rules_file:
        return json.load(rules_file)


# Load once when the application module starts.
RULES = load_rules()
USE_MOCK = os.getenv("USE_MOCK", "1").strip().lower() not in {"0", "false", "no"}
MODEL_PATH = Path(os.getenv("MODEL_PATH", "../models/best.onnx"))
if not MODEL_PATH.is_absolute():
    MODEL_PATH = (BASE_DIR / MODEL_PATH).resolve()

# Resolve canonical labels and aliases once at startup; inference may emit either.
RULE_LOOKUP: dict[str, tuple[str, dict[str, str]]] = {}
for canonical_name, rule in RULES.items():
    RULE_LOOKUP[canonical_name] = (canonical_name, rule)
    for alias in rule.get("aliases", []):
        RULE_LOOKUP[alias] = (canonical_name, rule)

app = FastAPI(title="Smart Waste Sorter API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def contract_http_error(_request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"error": "inference_failed"})


def enrich_detections(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    detections = []
    for item in raw:
        reported_name = str(item.get("class", "unknown"))
        match = RULE_LOOKUP.get(reported_name)
        # Return the rules.json canonical label for aliases; change this assignment
        # if the dataset/API contract later requires preserving the model label.
        class_name = match[0] if match else reported_name
        rule = match[1] if match else {}
        detection = dict(item)
        detection["class"] = class_name
        detection["class_vi"] = rule.get("class_vi", class_name)
        detection["bin_group"] = rule.get("bin_group", "residual")
        detection["bin_color"] = rule.get("bin_color", "gray")
        detection["instruction"] = rule.get("instruction", DEFAULT_INSTRUCTION)
        detections.append(detection)
    return detections


@app.get("/health")
def health() -> dict[str, Any]:
    model_found = MODEL_PATH.is_file()
    degraded = not USE_MOCK and not model_found
    return {
        "status": "degraded" if degraded else "ok",
        "mode": "mock" if USE_MOCK else "model",
        "model_path": str(MODEL_PATH),
        "model_found": model_found,
    }


@app.post("/detect")
async def detect(file: UploadFile = File(...)) -> dict[str, Any]:
    try:
        if not USE_MOCK and not MODEL_PATH.is_file():
            raise HTTPException(status_code=500, detail={"error": "inference_failed"})
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail={"error": "invalid_image"})

        image_bytes = await file.read(MAX_IMAGE_BYTES + 1)
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail={"error": "file_too_large"})

        try:
            with Image.open(BytesIO(image_bytes)) as image:
                if image.format != ALLOWED_TYPES[content_type]:
                    raise HTTPException(status_code=400, detail={"error": "invalid_image"})
                image.load()
                image_width, image_height = image.size
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise HTTPException(status_code=400, detail={"error": "invalid_image"}) from exc

        started = time.perf_counter()
        try:
            raw = mock_inference(image_bytes) if USE_MOCK else run_inference(image_bytes)
            if not raw:
                raw = mock_inference(image_bytes)
        except Exception as exc:
            raise HTTPException(status_code=500, detail={"error": "inference_failed"}) from exc
        inference_ms = round((time.perf_counter() - started) * 1000)

        return {
            "image_width": image_width,
            "image_height": image_height,
            "inference_ms": inference_ms,
            "detections": enrich_detections(raw),
        }
    finally:
        await file.close()


# Mount last so the frontend fallback never shadows /health or /detect.
FRONTEND_DIR = (Path(__file__).resolve().parent.parent / "frontend").resolve()
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

