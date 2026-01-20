from fastapi import FastAPI, UploadFile, File, HTTPException
from ultralytics import YOLO
from backend.preprocess import image_metrics, enhance_if_needed
import cv2
import numpy as np

app = FastAPI(title="Smart-Recipee Detect API")

MODEL_PATH = "yolov8n.pt"
# MODEL_PATH = "models/best.pt"

# load once on startup (W for speed)
model = YOLO(MODEL_PATH)

CONF = 0.4
IOU = 0.5

def infer_image(img_bgr):
    results = model(img_bgr, conf=CONF, iou=IOU)
    r = results[0]

    merged = {}  # ingredient -> {ingredient, count, best:{...}, boxes:[...]}

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
                "ingredient": name,
                "count": 1,
                "best": box_item.copy(),
                "boxes": [box_item],
            }
        else:
            merged[name]["count"] += 1
            merged[name]["boxes"].append(box_item)

            # update best if this one is higher confidence
            if conf > merged[name]["best"]["confidence"]:
                merged[name]["best"] = box_item.copy()

    merged_list = list(merged.values())
    merged_list.sort(key=lambda d: d["best"]["confidence"], reverse=True)
    return merged_list


@app.get("/health")
def health():
    return {"status": "ok"}

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
    ingredient_list = [d["ingredient"] for d in detections]

    return {
        "ingredient_list": ingredient_list,
        "enhanced": enhanced,
        "metrics": metrics,
        "detections": detections
    }
