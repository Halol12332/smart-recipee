import cv2
import numpy as np

def image_metrics(img_bgr):
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    brightness = float(gray.mean())
    contrast = float(gray.std())

    lap = cv2.Laplacian(gray, cv2.CV_64F)
    blur = float(lap.var())

    return {
        "brightness_mean": round(brightness, 2),
        "contrast_std": round(contrast, 2),
        "blur_var": round(blur, 2),
    }

def enhance_if_needed(img_bgr, metrics):
    # simple rules (tweak later based on testing)
    too_dark = metrics["brightness_mean"] < 60
    low_contrast = metrics["contrast_std"] < 30

    if not (too_dark or low_contrast):
        return img_bgr, False

    # CLAHE on luminance channel (safe enhancement)
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l2 = clahe.apply(l)

    lab2 = cv2.merge([l2, a, b])
    out = cv2.cvtColor(lab2, cv2.COLOR_LAB2BGR)
    return out, True
