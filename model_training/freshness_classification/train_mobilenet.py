import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader

def main():
    # 1. Hardware Check
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"Hardware Check: Using device: {device}")

    # 2. Data Preprocessing (Forcing the 224x224 crop)
    data_transforms = {
        'train': transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]) # Standard ImageNet Colors
        ]),
        'val': transforms.Compose([   # Updated to match your new 'val' folder
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
    }

    # 3. Load the Data
    print("\nLoading Freshness Dataset...")
    data_dir = 'dataset'
    
    image_datasets = {x: datasets.ImageFolder(f"{data_dir}/{x}", data_transforms[x]) for x in ['train', 'val']}
    
    dataloaders = {
        'train': DataLoader(image_datasets['train'], batch_size=16, shuffle=True, num_workers=2),
        'val':  DataLoader(image_datasets['val'], batch_size=16, shuffle=False, num_workers=2)
    }
    
    class_names = image_datasets['train'].classes
    print(f"Successfully loaded classes: {class_names}")

    # 4. Initialize MobileNetV2
    print("\nInitializing MobileNetV2 Engine...")
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
    
    # We strip out the original 1000-class output and replace it with our 2 classes
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, len(class_names))
    model = model.to(device)

    # 5. Setup Optimizer and Loss
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    # 6. The Training Loop
    epochs = 20
    print(f"\nStarting MobileNetV2 Training for {epochs} Epochs...")
    
    for epoch in range(epochs):
        print(f"\nEpoch {epoch+1}/{epochs}")
        print("-" * 20)
        
        for phase in ['train', 'val']:
            if phase == 'train':
                model.train()
            else:
                model.eval()

            running_loss = 0.0
            running_corrects = 0

            for inputs, labels in dataloaders[phase]:
                inputs = inputs.to(device)
                labels = labels.to(device)

                optimizer.zero_grad()

                # Only track gradients if in train phase
                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)

            epoch_loss = running_loss / len(image_datasets[phase])
            epoch_acc = running_corrects.double() / len(image_datasets[phase])

            print(f"{phase.capitalize()} Loss: {epoch_loss:.4f} | Accuracy: {epoch_acc:.4f}")

    print("\nTraining Complete! Saving weights...")
    torch.save(model.state_dict(), "mobilenetv2_freshness.pth")
    print("Model saved to 'mobilenetv2_freshness.pth'")

if __name__ == "__main__":
    main()
