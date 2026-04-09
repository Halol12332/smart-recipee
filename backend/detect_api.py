from fastapi import FastAPI, UploadFile, File, HTTPException
from ultralytics import YOLO
from preprocess import image_metrics, enhance_if_needed
import cv2
import numpy as np
from datetime import datetime
from pathlib import Path

app = FastAPI(title="Smart-Recipee Detect API")

# ✅ Use your trained weights
MODEL_PATH = "models/best.pt"
# Better long-term:
# MODEL_PATH = "models/best.pt"

model = YOLO(MODEL_PATH)

CONF = 0.4
IOU = 0.5

# Decide counting behavior per class
# "item" = countable objects
# "pack" = packaged item (tempeh, grape pack)
# "presence" = count is meaningless, always 1 if present
COUNT_TYPE = {
    "egg": "item",
    "apple": "item",
    "onion": "item",
    "cucumber": "item",
    "lime": "item",
    "orange": "item",
    "potato": "item",
    "garlic": "item",
    "ginger": "item",
    "chili": "item",

    "tempeh": "pack",
    "tofu": "pack",
    "grape": "pack",
    "coconut_milk": "pack",  # if it's carton/can/bottle type

    "leafy_greens": "presence",
    "pakchoy": "presence",
    "lemongrass": "presence",
    "cabbage": "presence",
    "anchovies": "presence",
}

FLAG_TYPES = {"unknown_bag"}  # treat these as flags, not ingredients

def infer_image(img_bgr):
    results = model(img_bgr, conf=CONF, iou=IOU)
    r = results[0]

    merged = {}  # name -> {"name","count","best","boxes"}

    for b in r.boxes:
        cls = int(b.cls[0])
        conf = float(b.conf[0])
        name = model.names.get(cls, str(cls))
        x1, y1, x2, y2 = b.xyxy[0].tolist()

        box_item = {
            "confidence": round(conf, 3),
            "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
        }

        if name not in merged:
            merged[name] = {
                "name": name,
                "count": 1,
                "best": box_item.copy(),
                "boxes": [box_item],
            }
        else:
            merged[name]["count"] += 1
            merged[name]["boxes"].append(box_item)
            if conf > merged[name]["best"]["confidence"]:
                merged[name]["best"] = box_item.copy()

    merged_list = list(merged.values())
    merged_list.sort(key=lambda d: d["best"]["confidence"], reverse=True)
    return merged_list


def to_contract(detections, image_id=None):
    now = datetime.now().astimezone().isoformat(timespec="seconds")

    ingredients = []
    flags = []

    for d in detections:
        name = d["name"]
        best_conf = float(d["best"]["confidence"])
        raw_count = int(d["count"])

        # Flags (unknown_bag etc)
        if name in FLAG_TYPES:
            flags.append({
                "type": name,
                "confidence": best_conf,
                "count": raw_count,
                "message": "Uncertain contents. Ask user to confirm."
            })
            continue

        count_type = COUNT_TYPE.get(name, "presence")

        # If it's presence-only, don't pretend counting is real
        if count_type == "presence":
            count = 1
        else:
            count = raw_count

        ingredients.append({
            "name": name,
            "confidence": best_conf,
            "count": count,
            "count_type": count_type
        })

    # sort by confidence descending
    ingredients.sort(key=lambda x: x["confidence"], reverse=True)

    return {
        "schema_version": "1.0",
        "source": {
            "module": "ingredient_detector",
            "model": Path(MODEL_PATH).name,
            "run_id": "train4",
            "image_id": image_id,
            "timestamp": now
        },
        "ingredients": ingredients,
        "flags": flags,
        "meta": {
            "confidence_threshold": CONF,
            "nms_iou": IOU
        }
    }


@app.get("/health")
def health():
    return {"status": "ok", "model_path": MODEL_PATH}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Upload a JPG or PNG image.")

    data = await file.read()
    np_img = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    metrics = image_metrics(img)
    img2, enhanced = enhance_if_needed(img, metrics)

    detections = infer_image(img2)
    payload = to_contract(detections, image_id=file.filename)

    # optional: include debug fields for your own UI
    payload["meta"]["enhanced"] = enhanced
    payload["meta"]["metrics"] = metrics

    return payload
