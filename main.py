import traceback

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import os
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Enable CORS so your frontend app can talk to this local server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your custom trained YOLO model weights
MODEL_PATH = "best.pt"
ONNX_PATH = "best.onnx"

if not os.path.exists(MODEL_PATH):
  raise RuntimeError(f"Model weights not found at {MODEL_PATH}")

# Export to ONNX only if it hasn't been exported yet
if not os.path.exists(ONNX_PATH):
  print("Exporting model to ONNX format...")
  temp_model = YOLO(MODEL_PATH)
  temp_model.export(format="onnx")



model = YOLO(MODEL_PATH)
# Dictionary mapping your model's class names to your app's exact SVG paths
# Note: Ensure these keys match the exact class names labels you used in Roboflow!
CLASS_TO_SVG = {
    "WD": "tiles/01-white-dragon.svg",
    "GD": "tiles/02-green-dragon.svg",
    "RD": "tiles/03-red-dragon.svg",
    "EW": "tiles/04-east-wind.svg",
    "SW": "tiles/05-south-wind.svg",
    "WW": "tiles/06-west-wind.svg",
    "NW": "tiles/07-north-wind.svg",
    "1C": "tiles/08-characters-1.svg",
    "2C": "tiles/09-characters-2.svg",
    "3C": "tiles/10-characters-3.svg",
    "4C": "tiles/11-characters-4.svg",
    "5C": "tiles/12-characters-5.svg",
    "6C": "tiles/13-characters-6.svg",
    "7C": "tiles/14-characters-7.svg",
    "8C": "tiles/15-characters-8.svg",
    "9C": "tiles/16-characters-9.svg",
    "1D": "tiles/17-circles-1.svg",
    "2D": "tiles/18-circles-2.svg",
    "3D": "tiles/19-circles-3.svg",
    "4D": "tiles/20-circles-4.svg",
    "5D": "tiles/21-circles-5.svg",
    "6D": "tiles/22-circles-6.svg",
    "7D": "tiles/23-circles-7.svg",
    "8D": "tiles/24-circles-8.svg",
    "9D": "tiles/25-circles-9.svg",
    "1B": "tiles/26-bamboos-1.svg",
    "2B": "tiles/27-bamboos-2.svg",
    "3B": "tiles/28-bamboos-3.svg",
    "4B": "tiles/29-bamboos-4.svg",
    "5B": "tiles/30-bamboos-5.svg",
    "6B": "tiles/31-bamboos-6.svg",
    "7B": "tiles/32-bamboos-7.svg",
    "8B": "tiles/33-bamboos-8.svg",
    "9B": "tiles/34-bamboos-9.svg",
    "1S": "tiles/35-spring.svg",
    "2S": "tiles/36-summer.svg",
    "3S": "tiles/37-autumn.svg",
    "4S": "tiles/38-winter.svg",
    "1F": "tiles/39-plum.svg",
    "2F": "tiles/40-orchid.svg",
    "3F": "tiles/41-chrysanthemum.svg",
    "4F": "tiles/42-bamboo.svg"
}

@app.post("/scan-hand")
async def scan_hand(file: UploadFile = File(...)):
  try:
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    # Run YOLO inference with optimized image size
    results = model(
            image,
            imgsz=320,
            conf=0.5,  # Slightly raise confidence to filter weak ghost boxes
            iou=0.4,  # Lower IoU threshold means stricter overlapping box removal
            agnostic_nms=True,  # Removes overlapping boxes even if they are different classes
        )
    detections = []

    for r in results:
      boxes = r.boxes
      for box in boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        xyxy = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
        x_center = (xyxy[0] + xyxy[2]) / 2
        y_center = (xyxy[1] + xyxy[3]) / 2

        svg_path = CLASS_TO_SVG.get(cls_name)
        if svg_path:
          detections.append({
              "x_center": x_center,
              "y_center": y_center,
              "svg_path": svg_path,
              "conf": conf,
          })

    if not detections:
      return {"tiles": []}
    # --- Deduplication Safety Net ---
    # Sort by highest confidence first, then filter out boxes that overlap too closely
    detections.sort(key=lambda d: d["conf"], reverse=True)
    filtered_detections = []
    min_distance = 25  # Minimum pixel distance apart a tile center must be

    for det in detections:
      is_duplicate = False
      for existing in filtered_detections:
        dist = (
            (det["x_center"] - existing["x_center"]) ** 2
            + (det["y_center"] - existing["y_center"]) ** 2
        ) ** 0.5
        if dist < min_distance:
          is_duplicate = True
          break
      if not is_duplicate:
        filtered_detections.append(det)

    detections = filtered_detections

    # --- Robust Dynamic Row Clustering ---
    # 1. Sort all tiles top-to-bottom by y_center
    detections.sort(key=lambda d: d["y_center"])

    rows = []
    current_row = []
    tolerance = 45  # Pixel threshold to separate rows

    for det in detections:
      if not current_row:
        current_row.append(det)
      else:
        avg_y = sum(d["y_center"] for d in current_row) / len(current_row)
        if abs(det["y_center"] - avg_y) <= tolerance:
          current_row.append(det)
        else:
          # Sort the completed row left-to-right by x_center
          current_row.sort(key=lambda d: d["x_center"])
          rows.append(current_row)
          current_row = [det]

    # Don't forget the last remaining row
    if current_row:
      current_row.sort(key=lambda d: d["x_center"])
      rows.append(current_row)

    # Flatten rows back into a single ordered list of SVG paths
    sorted_tile_paths = []
    for row in rows:
      for det in row:
        sorted_tile_paths.append(det["svg_path"])

    return {"tiles": sorted_tile_paths}

  except Exception as e:
    # This will print the exact line causing any future errors in your terminal
    traceback.print_exc()
    raise HTTPException(status_code=500, detail=str(e))

# Serve all static frontend files from the current directory
app.mount("/", StaticFiles(directory=".", html=True), name="static")