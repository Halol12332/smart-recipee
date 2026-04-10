import os
from ultralytics import YOLO
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns

def main():
    print("Loading YOLOv8 Freshness Model...")
    # Path to the weights YOLO saved earlier
    model = YOLO(r"runs\classify\freshness_classification\freshness_model\weights\best.pt")

    val_dir = r"dataset\val"
    class_names = ['Fresh', 'Rotten']

    all_preds = []
    all_labels = []

    print("\nRunning inference on validation data. Please wait...")
    
    # Loop through the Fresh and Rotten folders
    for class_idx, class_name in enumerate(class_names):
        folder_path = os.path.join(val_dir, class_name)
        
        # Grab all images in the folder
        image_files = [f for f in os.listdir(folder_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        for img_name in image_files:
            img_path = os.path.join(folder_path, img_name)
            
            # Run YOLO inference silently
            results = model(img_path, verbose=False)
            
            # Extract the predicted class index (0 for Fresh, 1 for Rotten)
            pred_idx = results[0].probs.top1
            
            all_preds.append(pred_idx)
            all_labels.append(class_idx)

    # Generate the Classification Report
    print("\n" + "="*50)
    print("YOLOv8n-cls - CLASSIFICATION REPORT")
    print("="*50)
    print(classification_report(all_labels, all_preds, target_names=class_names, digits=4))

    # Generate and Save the Confusion Matrix Plot
    print("\nGenerating Confusion Matrix Image...")
    cm = confusion_matrix(all_labels, all_preds)
    
    plt.figure(figsize=(8, 6))
    # I changed the color to 'Greens' so it visually contrasts with your 'Blues' MobileNet matrix!
    sns.heatmap(cm, annot=True, fmt='d', cmap='Greens', xticklabels=class_names, yticklabels=class_names)
    plt.title('YOLOv8n-cls Freshness Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    
    plt.savefig('yolo_confusion_matrix.png', dpi=300, bbox_inches='tight')
    print("Success! Saved 'yolo_confusion_matrix.png' to your folder.")

if __name__ == "__main__":
    main()
