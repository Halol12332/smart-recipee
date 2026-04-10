import os
import shutil
import random

def main():
    print("Starting data reorganization...")
    
    # 1. Update this to match the exact path from your screenshot!
    # Tip: You can right-click the "Fruits_Vegetables" folder in VS Code and click "Copy Path"
    source_dir = r"datasets\muhriddinmuxiddinov\fruits-and-vegetables-dataset\versions\2\Fruits_Vegetables_Dataset(12000)"
    
    # The clean destination folder we want to create
    target_dir = "dataset"

    # 2. Create the clean PyTorch structure
    for split in ['train', 'test']:
        for cls in ['Fresh', 'Rotten']:
            os.makedirs(os.path.join(target_dir, split, cls), exist_ok=True)

    # 3. Loop through Fruits and Vegetables
    for category in ['Fruits', 'Vegetables']:
        cat_path = os.path.join(source_dir, category)
        if not os.path.exists(cat_path):
            print(f"Warning: Could not find {cat_path}")
            continue

        # Go through 'FreshApple', 'RottenTomato', etc.
        for folder_name in os.listdir(cat_path):
            folder_path = os.path.join(cat_path, folder_name)
            if not os.path.isdir(folder_path): 
                continue

            # Figure out if it goes in the Fresh or Rotten bucket
            if 'Fresh' in folder_name:
                target_class = 'Fresh'
            elif 'Rotten' in folder_name:
                target_class = 'Rotten'
            else:
                continue # Skip if it doesn't say Fresh or Rotten

            # Grab all the images
            images = [f for f in os.listdir(folder_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
            random.shuffle(images) # Shuffle them to ensure a random mix

            # Split 80% for training, 20% for testing
            split_idx = int(0.8 * len(images))
            train_imgs = images[:split_idx]
            test_imgs = images[split_idx:]

            # Copy to the new clean folders
            for img in train_imgs:
                # We rename the file slightly so an apple.jpg doesn't overwrite a tomato.jpg
                new_name = f"{folder_name}_{img}" 
                shutil.copy(os.path.join(folder_path, img), os.path.join(target_dir, 'train', target_class, new_name))
                
            for img in test_imgs:
                new_name = f"{folder_name}_{img}"
                shutil.copy(os.path.join(folder_path, img), os.path.join(target_dir, 'test', target_class, new_name))

            print(f"Processed {len(images)} images from {folder_name}...")

    print("\nSuccess! Your data is now perfectly formatted for PyTorch.")

if __name__ == "__main__":
    main()
