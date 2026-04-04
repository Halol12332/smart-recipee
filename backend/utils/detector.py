"""
Author: Jaya Hakim Prajna
Ingredient Detection & Freshness Adapter.

This file acts as the "bridge" between your RT-DETR object detector, 
your YOLOv8n-cls freshness classifier, and the existing recommendation API.

How it works:
1) /api/detect receives an uploaded image and a model_type ('rt-detr' or 'yolov8').
2) detect_ingredients_from_image() runs the selected model's inference.
3) For highly perishable items, it crops the bounding box and runs YOLOv8 freshness classification.
4) It returns JSON in a format the frontend (browse.js) already understands, 
   with updated freshness labels, color-coded bounding boxes, and individual cropped images.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, List

import cv2


def _now_iso() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%S')


# Lazy-loaded models dictionary to hold both detectors in memory safely
_MODELS = {
    'rt-detr': None,
    'yolov8': None,
    'freshness': None
}

# Ingredients that require freshness checking
PERISHABLE_ITEMS = {
    'apple', 'tomato', 'cabbage', 'leafy_greens', 'cucumber', 
    'lime', 'orange', 'pakchoy', 'brocolli', 'carrot'
}


def _load_models(model_type='rt-detr'):
    global _MODELS

    try:
        from ultralytics import YOLO, RTDETR  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "ultralytics is not installed. Install it with: pip install ultralytics"
        ) from e

    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))
    
    # 1. Load Freshness Classifier (Always YOLOv8n-cls)
    if _MODELS['freshness'] is None:
        freshness_path = os.environ.get(
            'FRESHNESS_MODEL_PATH',
            os.path.join(models_dir, 'freshnesscls_yolov8ncls.pt')
        )
        if not os.path.exists(freshness_path):
            raise FileNotFoundError(f"Freshness weights not found at: {freshness_path}")
        print("LOADING YOLOv8 FRESHNESS CLASSIFIER FROM:", freshness_path)
        _MODELS['freshness'] = YOLO(freshness_path)

    # 2. Load the requested Object Detector
    if model_type == 'yolov8':
        if _MODELS['yolov8'] is None:
            yolo_path = os.path.join(models_dir, 'detection_yolov8.pt')
            if not os.path.exists(yolo_path):
                raise FileNotFoundError(f"YOLOv8 weights not found at: {yolo_path}")
            print("LOADING YOLOv8 DETECTOR FROM:", yolo_path)
            _MODELS['yolov8'] = YOLO(yolo_path)
        detector = _MODELS['yolov8']
    
    else:  # Default to rt-detr
        if _MODELS['rt-detr'] is None:
            rtdetr_path = os.environ.get(
                'INGREDIENT_MODEL_PATH',
                os.path.join(models_dir, 'detection_rtdetr.pt')
            )
            if not os.path.exists(rtdetr_path):
                raise FileNotFoundError(f"RT-DETR weights not found at: {rtdetr_path}")
            print("LOADING RT-DETR DETECTOR FROM:", rtdetr_path)
            _MODELS['rt-detr'] = RTDETR(rtdetr_path)
        detector = _MODELS['rt-detr']
    
    return detector, _MODELS['freshness']


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _draw_detections(image, detections: List[Dict[str, Any]]):
    """Draw bounding boxes + labels with freshness states on image."""
    annotated = image.copy()

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        label = f'{det["name"]} {det["confidence"]:.2f}'

        # Change box color to red if rotten, otherwise green
        color = (0, 0, 255) if "rotten" in det["name"].lower() else (0, 255, 0)

        x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])

        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

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
            color,
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


def detect_ingredients_from_image(image_path: str, model_type: str = 'rt-detr') -> Dict[str, Any]:
    """
    Run Object detection (RT-DETR or YOLOv8), followed by YOLOv8n-cls for perishables.
    Returns:
    - aggregated ingredients (with freshness states and crop images)
    - raw detections with bbox, confidence, and crop images
    - annotated image filename
    """
    conf_th = float(os.environ.get('INGREDIENT_CONF_THRESHOLD', '0.5'))
    detector, freshness_classifier = _load_models(model_type)

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    # Ensure uploads directory exists before we start saving crops
    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
    _ensure_dir(uploads_dir)

    # 1. Run Object Detection (YOLOv8 or RT-DETR)
    results = detector.predict(source=image_path, conf=conf_th, verbose=False)
    r0 = results[0]

    by_name: Dict[str, Dict[str, Any]] = {}
    detections: List[Dict[str, Any]] = []

    if getattr(r0, 'boxes', None) is not None and len(r0.boxes) > 0:
        boxes = r0.boxes

        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            conf = float(boxes.conf[i].item())
            base_name = str(r0.names.get(cls_id, cls_id)).lower().strip()

            xyxy = boxes.xyxy[i].tolist()
            x1, y1, x2, y2 = [float(v) for v in xyxy]
            
            final_name = base_name

            # Crop the bounding box from the original image safely
            crop_y1, crop_y2 = max(0, int(y1)), max(0, int(y2))
            crop_x1, crop_x2 = max(0, int(x1)), max(0, int(x2))
            crop = image[crop_y1:crop_y2, crop_x1:crop_x2]
            
            crop_filename = None

            # 2. Run YOLOv8n-cls Freshness Evaluation on Perishables
            if base_name in PERISHABLE_ITEMS and crop.size > 0:
                fresh_results = freshness_classifier.predict(source=crop, verbose=False)
                fresh_r0 = fresh_results[0]
                fresh_id = fresh_r0.probs.top1
                fresh_state = str(fresh_r0.names.get(fresh_id)).lower()
                
                # Append freshness state (e.g., "rotten tomato" or "fresh tomato")
                final_name = f"{fresh_state} {base_name}"
            
            # 3. Save the cropped image for the frontend grid
            if crop.size > 0:
                crop_filename = f"crop_{uuid.uuid4().hex[:8]}.jpg"
                cv2.imwrite(os.path.join(uploads_dir, crop_filename), crop)

            det = {
                'name': final_name,
                'confidence': conf,
                'bbox': [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                'crop_image': crop_filename
            }
            detections.append(det)

            # Aggregate counts for the JSON payload (keep the best confidence crop)
            if final_name not in by_name:
                by_name[final_name] = {
                    'name': final_name,
                    'confidence': conf,
                    'count': 1,
                    'crop_image': crop_filename,
                    'detection_id': uuid.uuid4().hex[:8]  # Give this group a stable unique ID!
                }
            else:
                by_name[final_name]['count'] += 1
                if conf > by_name[final_name]['confidence']:
                    by_name[final_name]['confidence'] = conf
                    by_name[final_name]['crop_image'] = crop_filename

    ingredients: List[Dict[str, Any]] = sorted(
        by_name.values(),
        key=lambda x: x['confidence'],
        reverse=True
    )

    # 4. Draw Detections and Save Annotated Image
    annotated = _draw_detections(image, detections)

    base_name_file = os.path.splitext(os.path.basename(image_path))[0]
    annotated_filename = f"{base_name_file}_annotated_{uuid.uuid4().hex[:8]}.jpg"
    annotated_path = os.path.join(uploads_dir, annotated_filename)

    cv2.imwrite(annotated_path, annotated)

    return {
        'source': {
            'image': os.path.basename(image_path),
            'timestamp': _now_iso(),
        },
        'meta': {
            'confidence_threshold': conf_th,
            'detector_model': model_type,
            'total_detections': len(detections),
        },
        'ingredients': ingredients,
        'detections': detections,
        'annotated_image': annotated_filename,
        'flags': [],
    }
