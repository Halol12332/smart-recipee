from ultralytics import YOLO
import torch

def main():
    model = YOLO("yolov8n.pt")  #runs/detect/trainX/weights/best.pt
    model.train(
        data="myproject-10/data.yaml",
        imgsz=640,
        epochs=100,
        batch=8,      # 4GB VRAM safer than 16
        device=0,
        workers=4 
    )

if __name__ == "__main__":
    main()

