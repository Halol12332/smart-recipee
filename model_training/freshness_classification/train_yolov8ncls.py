from ultralytics import YOLO

def main():
    print("Initializing YOLOv8 Classification Engine...")
    # Load the pre-trained Nano classification model (extremely lightweight)
    model = YOLO("yolov8n-cls.pt") 
    
    print("Starting Freshness Training...")
    model.train(
        data="dataset",      # Points to the folder containing 'train' and 'val'
        epochs=20,           # Since you have time, 20 epochs gives much better accuracy
        imgsz=224,           # Standard classification crop size
        batch=16,            # Completely safe for your 4GB VRAM
        device=0,            # Uses your RTX 3050
        project="freshness_classification", 
        name="freshness_model" 
    )
    
    print("\nTraining Complete! Your freshness weights are saved.")

if __name__ == "__main__":
    main()
