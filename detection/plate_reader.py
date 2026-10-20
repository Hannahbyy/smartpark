import cv2
import re
import numpy as np

# Optional EasyOCR initialization if available
reader = None
try:
    import easyocr
    reader = easyocr.Reader(['en'], gpu=False)
except Exception as e:
    reader = None

def normalize_plate_string(text: str) -> str:
    """Normalize OCR output: uppercase, keep alphanumeric only"""
    if not text:
        return ""
    # Common OCR misread substitutions for Malaysian plates
    clean = re.sub(r'[^A-Za-z0-9]', '', text.upper())
    return clean

def read_plate(frame, car_bbox):
    """
    Given a frame and a vehicle bounding box [x1, y1, x2, y2],
    crop the lower half (where plates usually reside) and run OCR.
    Returns (plate_text, confidence)
    """
    x1, y1, x2, y2 = [int(v) for v in car_bbox]
    h = max(0, y2 - y1)
    w = max(0, x2 - x1)
    if h < 20 or w < 20 or frame is None:
        return "", 0.0

    # Ensure within bounds
    H, W = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(W, x2), min(H, y2)

    # Plate region is typically in the lower 45% of the vehicle
    plate_crop = frame[y1 + int(h * 0.55):y2, x1 + int(w * 0.15):x2 - int(w * 0.15)]
    if plate_crop.size == 0:
        plate_crop = frame[y1:y2, x1:x2]

    if reader is not None:
        try:
            gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
            results = reader.readtext(gray)
            best_text = ""
            best_conf = 0.0
            for bbox, text, conf in results:
                normalized = normalize_plate_string(text)
                # Typical Malaysian license plate length is 4 to 8 characters
                if len(normalized) >= 4 and conf > best_conf:
                    best_text = normalized
                    best_conf = float(conf)
            if best_text:
                return best_text, best_conf
        except Exception:
            pass

    return "", 0.0
