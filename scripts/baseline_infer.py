from ultralytics import YOLO
import cv2
import json
from pathlib import Path

# paths
IMG_PATH = Path("data/images.jpg")
OUT_DIR = Path("outputs")
OUT_DIR.mkdir(exist_ok=True)

MODEL_PATH = "yolov8n.pt"
# MODEL_PATH = "models/best.pt"

def main():
    if not IMG_PATH.exists():
        raise FileNotFoundError(f"Missing image: {IMG_PATH}. Put a file at data/images.jpg")

    model = YOLO(MODEL_PATH)

    # run inference
    results = model(str(IMG_PATH), conf=0.4, iou=0.5)
    r = results[0]

    # print detections
    print("Detected boxes:", len(r.boxes))
    if len(r.boxes) > 0:
        for b in r.boxes:
            cls = int(b.cls[0])
            conf = float(b.conf[0])
            name = model.names.get(cls, str(cls))
            print(f"- {name}: {conf:.3f}")

    # ---- JSON EXPORT (HERE) ----
    detections = []
    for b in r.boxes:
        cls = int(b.cls[0])
        conf = float(b.conf[0])
        name = model.names.get(cls, str(cls))

        x1, y1, x2, y2 = b.xyxy[0].tolist()  # [x1,y1,x2,y2]
        detections.append({
            "ingredient": name,
            "confidence": round(conf, 3),
            "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
        })

    json_path = OUT_DIR / "sample_detections.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"detections": detections}, f, indent=2)

    print(f"Saved JSON: {json_path}")
    # ----------------------------

    # save annotated output image
    annotated = r.plot()
    out_path = OUT_DIR / "sample_annotated.jpg"
    cv2.imwrite(str(out_path), annotated)
    print(f"Saved: {out_path}")

if __name__ == "__main__":
    main()
