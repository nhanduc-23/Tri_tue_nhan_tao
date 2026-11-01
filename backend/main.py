from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError


BASE_DIR = Path(__file__).resolve().parent
RULES_PATH = BASE_DIR / "rules.json"


def load_rules() -> dict[str, dict[str, str]]:
    with RULES_PATH.open("r", encoding="utf-8") as rules_file:
        return json.load(rules_file)


RULES = load_rules()

app = FastAPI(title="Smart Waste Sorter API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_inference(image: Image.Image) -> list[dict[str, Any]]:
    """Return mock detections; replace this function with ONNX inference later."""
    width, height = image.size
    class_name = "plastic_bottle"
    rule = RULES[class_name]
    return [
        {
            "class": class_name,
            "confidence": 0.91,
            "bbox": [
                round(width * 0.2),
                round(height * 0.2),
                round(width * 0.8),
                round(height * 0.8),
            ],
            "bin_color": rule["bin_color"],
            "instruction": rule["instruction"],
        }
    ]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)) -> dict[str, list[dict[str, Any]]]:
    try:
        image = Image.open(file.file).convert("RGB")
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image") from exc
    finally:
        await file.close()

    return {"detections": run_inference(image)}

