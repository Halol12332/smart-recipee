import torch
import torch.nn as nn
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def main():
    print("Setting up Evaluation Pipeline...")
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    
    # 1. Setup Data Loader (Must match training preprocessing exactly)
    data_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    val_dataset = datasets.ImageFolder('dataset/val', data_transforms)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, num_workers=2)
    class_names = val_dataset.classes

    # 2. Load the trained MobileNetV2 Model
    print("Loading MobileNetV2 Weights...")
    model = models.mobilenet_v2(weights=None) # We don't need default weights, we have our own!
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, len(class_names))
    
    # Load YOUR specific trained weights
    model.load_state_dict(torch.load("mobilenetv2_freshness.pth", map_location=device, weights_only=True))
    model = model.to(device)
    model.eval() # Set to evaluation mode

    # 3. Run Inference on the Validation Set
    print("\nRunning inference on validation data. Please wait...")
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs = inputs.to(device)
            labels = labels.to(device)
            
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    # 4. Generate the Classification Report (Precision, Recall, F1-Score)
    print("\n" + "="*50)
    print("MOBILE NET V2 - CLASSIFICATION REPORT")
    print("="*50)
    print(classification_report(all_labels, all_preds, target_names=class_names, digits=4))

    # 5. Generate and Save the Confusion Matrix Plot
    print("\nGenerating Confusion Matrix Image...")
    cm = confusion_matrix(all_labels, all_preds)
    
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=class_names, yticklabels=class_names)
    plt.title('MobileNetV2 Freshness Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    
    # Save the plot so you can put it in your thesis!
    plt.savefig('mobilenet_confusion_matrix.png', dpi=300, bbox_inches='tight')
    print("Success! Saved 'mobilenet_confusion_matrix.png' to your folder.")

if __name__ == "__main__":
    main()
