import sys, json
from pathlib import Path
import requests

API = "http://127.0.0.1:8001/detect"

def main():
    if len(sys.argv) < 2:
        print("Usage: python run_detect_and_save.py path/to/image.jpg")
        sys.exit(1)

    img_path = Path(sys.argv[1])
    if not img_path.exists():
        print("Image not found:", img_path)
        sys.exit(1)

    with img_path.open("rb") as f:
        files = {"file": (img_path.name, f, "image/jpeg")}
        r = requests.post(API, files=files, timeout=120)

    r.raise_for_status()
    payload = r.json()

    out_path = Path(__file__).resolve().parent.parent / "frontend" / "detected_ingredients.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Saved:", out_path)

if __name__ == "__main__":
    main()
