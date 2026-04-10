from ultralytics import RTDETR

def main():
    print("Initializing RT-DETR Transformer Evaluation...")
    model = RTDETR("runs/detect/rtdetr_training/fridge_model6/weights/best.pt") 
    
    # Run the validation
    print("Running validation images through the model. This will take a moment...")
    metrics = model.val(data="myproject-7/data.yaml", split="val", verbose=False)
    
    # --- OVERALL RESULTS ---
    print("\n" + "="*65)
    print("                 RT-DETR OVERALL RESULTS")
    print("="*65)
    print(f"Overall mAP50-95 (Strict Accuracy):   {metrics.box.map:.4f}")
    print(f"Overall mAP@50 (Standard Accuracy):   {metrics.box.map50:.4f}")
    print(f"Overall mAP@75 (Rigorous Accuracy):   {metrics.box.map75:.4f}")
    
    # --- CLASS-BY-CLASS RESULTS ---
    print("\n" + "="*65)
    print("              RT-DETR CLASS-BY-CLASS RESULTS")
    print("="*65)
    print(f"{'Class Name':>16} | {'mAP@50':>10} | {'mAP@75':>10} | {'mAP50-95':>10}")
    print("-" * 65)
    
    ap_classes = metrics.box.ap_class_index
    class_names = metrics.names
    
    for i, c in enumerate(ap_classes):
        name = class_names[c]
        m50 = metrics.box.ap50[i]
        m75 = metrics.box.all_ap[i, 5] 
        m50_95 = metrics.box.ap[i]
        
        print(f"{name:>16} | {m50:10.4f} | {m75:10.4f} | {m50_95:10.4f}")
    print("="*65)

if __name__ == "__main__":
    main()
