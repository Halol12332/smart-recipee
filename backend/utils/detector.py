"""Ingredient detection adapter.

This file is meant to be the "bridge" between your YOLO ingredient detector
and the existing recommendation API.

How it works:
1) /api/detect receives an uploaded image.
2) detect_ingredients_from_image(image_path) runs YOLO inference.
3) It returns JSON in a format the frontend (browse.js) already understands.

Plug your own model weights by setting env var:
  INGREDIENT_MODEL_PATH=/path/to/best.pt

And optionally:
  INGREDIENT_CONF_THRESHOLD=0.5
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, List

import cv2


def _now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%S')


# Lazy-loaded YOLO model
_MODEL = None


def _load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "ultralytics is not installed. Install it with: pip install ultralytics"
        ) from e

    model_path = os.environ.get(
        'INGREDIENT_MODEL_PATH',
        os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')
    )

    model_path = os.path.abspath(model_path)
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"YOLO weights not found at: {model_path}. "
            "Set INGREDIENT_MODEL_PATH to your best.pt path."
        )

    print("LOADING YOLO WEIGHTS FROM:", model_path)
    _MODEL = YOLO(model_path)
    return _MODEL


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _draw_detections(image, detections: List[Dict[str, Any]]):
    """Draw bounding boxes + labels on image."""
    annotated = image.copy()

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        label = f'{det["name"]} {det["confidence"]:.2f}'

        x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])

        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

        (text_w, text_h), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
        )

        text_y1 = max(0, y1 - text_h - baseline - 6)
        text_y2 = y1
        text_x2 = x1 + text_w + 8

        cv2.rectangle(
            annotated,
            (x1, text_y1),
            (text_x2, text_y2),
            (0, 255, 0),
            -1
        )

        cv2.putText(
            annotated,
            label,
            (x1 + 4, y1 - 6),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 0),
            2,
            cv2.LINE_AA
        )

    return annotated


def detect_ingredients_from_image(image_path: str) -> Dict[str, Any]:
    """
    Run YOLO detection and return:
    - aggregated ingredients
    - raw detections with bbox + confidence
    - annotated image filename
    """

    conf_th = float(os.environ.get('INGREDIENT_CONF_THRESHOLD', '0.5'))
    model = _load_model()

    results = model.predict(source=image_path, conf=conf_th, verbose=False)
    r0 = results[0]

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    by_name: Dict[str, Dict[str, Any]] = {}
    detections: List[Dict[str, Any]] = []

    if getattr(r0, 'boxes', None) is not None and len(r0.boxes) > 0:
        boxes = r0.boxes

        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            conf = float(boxes.conf[i].item())
            name = str(r0.names.get(cls_id, cls_id)).lower().strip()

            xyxy = boxes.xyxy[i].tolist()
            x1, y1, x2, y2 = [float(v) for v in xyxy]

            det = {
                'name': name,
                'confidence': conf,
                'bbox': [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            }
            detections.append(det)

            if name not in by_name:
                by_name[name] = {
                    'name': name,
                    'confidence': conf,
                    'count': 1,
                }
            else:
                by_name[name]['count'] += 1
                if conf > by_name[name]['confidence']:
                    by_name[name]['confidence'] = conf

    ingredients: List[Dict[str, Any]] = sorted(
        by_name.values(),
        key=lambda x: x['confidence'],
        reverse=True
    )

    annotated = _draw_detections(image, detections)

    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    _ensure_dir(uploads_dir)

    base_name = os.path.splitext(os.path.basename(image_path))[0]
    annotated_filename = f"{base_name}_annotated_{uuid.uuid4().hex[:8]}.jpg"
    annotated_path = os.path.join(uploads_dir, annotated_filename)

    cv2.imwrite(annotated_path, annotated)

    return {
        'source': {
            'image': os.path.basename(image_path),
            'timestamp': _now_iso(),
        },
        'meta': {
            'confidence_threshold': conf_th,
            'model_path': os.environ.get('INGREDIENT_MODEL_PATH', 'backend/models/best.pt'),
            'total_detections': len(detections),
        },
        'ingredients': ingredients,
        'detections': detections,
        'annotated_image': annotated_filename,
        'flags': [],
    }
