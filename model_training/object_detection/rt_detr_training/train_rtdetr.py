from ultralytics import RTDETR

def main():
    print("Initializing RT-DETR Transformer Model...")
    # Loading the RT-DETR large model (Ultralytics will automatically download this .pt file)
    model = RTDETR("rtdetr-l.pt") 
    
    print("Starting Training (Optimized for 4GB VRAM)...")
    model.train(
        data="myproject-10/data.yaml", # Path to your manually downloaded YOLO format
        epochs=100,             # Matching YOLOv8 and Faster R-CNN for a fair test
        imgsz=640,              # RT-DETR works well with standard 640x640 resolution
        batch=2,                # CRITICAL for 4GB VRAM. Transformers are highly memory-hungry!
        device=0,               # Run on your RTX 3050 GPU
        workers=2,              # Keep this low to prevent Windows system RAM from freezing
        project="rtdetr_training", # Keeps output folders strictly organized
        name="fridge_model"     # Saves weights to rtdetr_training/fridge_model/weights/best.pt
    )
    
    print("\nRT-DETR Training Complete! Your transformer weights are saved.")

if __name__ == "__main__":
    main()
