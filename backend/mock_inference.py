"""Small deterministic detections used while the trained model is unavailable."""

from io import BytesIO

from PIL import Image


def mock_inference(image_bytes: bytes) -> list[dict]:
    """Return one or two in-bounds mock detections in uploaded-image pixels."""
    with Image.open(BytesIO(image_bytes)) as image:
        width, height = image.size

    margin_x = min(max(0, width // 10), width - 1)
    margin_y = min(max(0, height // 10), height - 1)
    first = {
        "class": "plastic_bottle",
        "confidence": 0.91,
        "bbox": [
            margin_x,
            margin_y,
            min(width, max(margin_x + 1, width * 6 // 10)),
            min(height, max(margin_y + 1, height * 8 // 10)),
        ],
    }
    detections = [first]
    if width >= 4 and height >= 4:
        x1, y1 = width * 65 // 100, height * 20 // 100
        x2, y2 = max(x1 + 1, width * 9 // 10), max(y1 + 1, height * 7 // 10)
        if x2 <= width and y2 <= height:
            detections.append({"class": "metal_can", "confidence": 0.84, "bbox": [x1, y1, x2, y2]})
    return detections
