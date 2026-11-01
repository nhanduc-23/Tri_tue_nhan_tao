"""Inference integration point owned by TV3.

See docs/api-contract.md for the internal run_inference contract. TV4 enriches
the returned detections using backend/rules.json.
"""


def run_inference(image_bytes: bytes) -> list[dict]:
    """Return detections with class, confidence, and bbox fields.

    Coordinates in bbox are [x1, y1, x2, y2] pixels in the uploaded image.
    TODO: TV3 thay bằng ONNX Runtime.
    """
    return []
