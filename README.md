hi, this is README.md

change directory to smart-recipee folder. then activate venv
> .\.venv\Scripts\Activate.ps1

fridge image:
data/images.jpg

run to view detected ingredients. 
> python scripts/baseline_infer.py

run for backend API
> uvicorn backend.main:app --reload

then copy the http://127.0.0.1:8000/docs to browser. 
click on post /detect, then click try it out, then choose file to upload your fridge image.
then press execute. 

i made a backend/preprocess.py for preprocessing if the image is too dark/noisy/blurry.
