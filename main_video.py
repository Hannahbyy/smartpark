import os
import json
import time
import threading
import cv2
import numpy as np
from flask import Flask, jsonify, send_from_directory, request
from ultralytics import YOLO
from shapely.geometry import Polygon
from detection import plate_reader
from registry import registry_store

app = Flask(__name__, static_folder="static")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPOTS_PATH = os.path.join(BASE_DIR, "spots.json")
STATUS_PATH = os.path.join(BASE_DIR, "status.json")
PLATE_READS_PATH = os.path.join(BASE_DIR, "plate_reads.json")
SOURCE_CONFIG_PATH = os.path.join(BASE_DIR, "active_source.json")
VIDEO_PATH = os.path.join(BASE_DIR, "carpark_video.mp4")

TOTAL_SPOTS = 55
DASHBOARD_SPOTS = [f"spot-{i}" for i in range(TOTAL_SPOTS)]

state_lock = threading.Lock()
state = {
    "status": {s_id: "empty" for s_id in DASHBOARD_SPOTS},
    "details": {},
    "violations": [],
    "plate_reads": [],
    "frame_index": 0
}

def load_spots():
    if os.path.exists(SPOTS_PATH):
        try:
            with open(SPOTS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def load_active_source():
    if os.path.exists(SOURCE_CONFIG_PATH):
        try:
            with open(SOURCE_CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError) as err:
            print(f"[main_video] Could not read active source: {err}")
    return {"source_type": "video", "source_path": VIDEO_PATH, "camera_index": 0}

def resolve_video_path(source_path):
    candidate = source_path or VIDEO_PATH
    if not os.path.isabs(candidate):
        candidate = os.path.join(BASE_DIR, candidate)
    return os.path.abspath(candidate)

def video_loop():
    """Background thread that loops through carpark_video.mp4, runs YOLO on every 30th frame,
       checks Shapely polygon overlap (>30% area) for each spot in spots.json, and serves /get_status.
    """
    global state

    model = YOLO("yolov8n.pt")
    
    cap = None
    active_source = None
    frame_count = 0

    while True:
        source_config = load_active_source()
        source_type = source_config.get("source_type", "video")
        source_key = (
            source_type,
            source_config.get("source_path", VIDEO_PATH),
            int(source_config.get("camera_index", 0))
        )
        if source_key != active_source:
            if cap is not None:
                cap.release()
            cap = None
            frame_count = 0
            active_source = source_key
            print(f"[main_video] Switched detection source to {source_key}")

        if cap is None:
            if source_type == "camera":
                cap = cv2.VideoCapture(int(source_config.get("camera_index", 0)))
            else:
                vid_file = resolve_video_path(source_config.get("source_path", VIDEO_PATH))
                if os.path.exists(vid_file):
                    cap = cv2.VideoCapture(vid_file)
                else:
                    print(f"[main_video] Selected video not found: {vid_file}")
                    time.sleep(1)
                    continue

        ret, frame = cap.read()
        if not ret:
            # Loop the video seamlessly
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # Run detection on every 30th frame (~1 second interval)
        if frame_count % 30 == 0:
            parking_spots = load_spots()
            new_status = {s_id: "empty" for s_id in DASHBOARD_SPOTS}
            new_details = {}
            new_violations = []
            new_plate_reads = []

            # Classes: 2=car, 3=motorcycle, 5=bus, 7=truck
            results = model.predict(source=frame, classes=[2, 3, 5, 7], conf=0.25, verbose=False)
            detected_boxes = []
            for box in results[0].boxes:
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                car_poly = Polygon([(x1, y1), (x2, y1), (x2, y2), (x1, y2)])
                detected_boxes.append((car_poly, [x1, y1, x2, y2]))

            # Run OCR on each detected vehicle and associate the read with a bay
            for car_index, (car_poly, bbox) in enumerate(detected_boxes):
                plate_text, confidence = plate_reader.read_plate(frame, bbox)
                if not plate_text or confidence <= 0:
                    continue

                associated_spot = None
                best_overlap = 0.0
                for spot_id, points in parking_spots.items():
                    if len(points) != 4:
                        continue
                    try:
                        spot_poly = Polygon(points)
                        if spot_poly.is_valid and spot_poly.area > 0:
                            overlap = spot_poly.intersection(car_poly).area / spot_poly.area
                            if overlap > best_overlap:
                                best_overlap = overlap
                                associated_spot = spot_id
                    except Exception:
                        continue

                owner_record = registry_store.lookup_owner(plate_text)
                new_plate_reads.append({
                    "id": f"plate-{frame_count}-{car_index}",
                    "plate": plate_text,
                    "confidence": round(float(confidence), 4),
                    "timestamp": time.strftime("%H:%M:%S"),
                    "spotId": associated_spot if best_overlap > 0.15 else None,
                    "registered": owner_record is not None,
                    "ownerName": owner_record.get("name") if owner_record else None,
                    "vehicleType": owner_record.get("vehicle_type") if owner_record else None
                })

            # Evaluate Shapely intersection with each spot polygon in spots.json
            for spot_id, points in parking_spots.items():
                if len(points) != 4:
                    continue
                try:
                    spot_poly = Polygon(points)
                    if not spot_poly.is_valid or spot_poly.is_empty:
                        continue
                    spot_area = spot_poly.area
                    if spot_area <= 0:
                        continue

                    # Check overlap with each detected vehicle
                    is_occupied = False
                    overlapping_cars = []

                    for car_poly, bbox in detected_boxes:
                        if car_poly.intersects(spot_poly):
                            inter_area = car_poly.intersection(spot_poly).area
                            ratio = inter_area / spot_area
                            # User specification: overlap more than 30% decides 'occupied' vs 'empty'
                            if ratio > 0.30:
                                is_occupied = True
                                overlapping_cars.append((ratio, bbox))

                    if is_occupied:
                        new_status[spot_id] = "occupied"
                        new_details[spot_id] = {
                            "status": "occupied",
                            "spot_id": spot_id
                        }
                except Exception as err:
                    print(f"[main_video] Spot geometry error for {spot_id}: {err}")

            with state_lock:
                state["status"] = new_status
                state["details"] = new_details
                state["violations"] = new_violations
                state["plate_reads"] = new_plate_reads
                state["frame_index"] = frame_count

            # Write latest status to status.json so both Node and Python can share the state
            try:
                with open(STATUS_PATH, "w", encoding="utf-8") as f:
                    json.dump(new_status, f, indent=2)
            except Exception:
                pass

            try:
                with open(PLATE_READS_PATH, "w", encoding="utf-8") as f:
                    json.dump(new_plate_reads, f, indent=2)
            except Exception as err:
                print(f"[main_video] Could not write plate reads: {err}")

        frame_count += 1
        time.sleep(0.03)

@app.route('/get_status')
def get_status():
    """Polled by frontend every 2 seconds to color the grid red/green and update sidebar counts"""
    with state_lock:
        return jsonify(state["status"])

@app.route('/get_violations')
def get_violations():
    with state_lock:
        return jsonify(state["violations"])

@app.route('/get_details')
def get_details():
    with state_lock:
        return jsonify(state["details"])

@app.route('/admin/api/plate_reads')
def get_plate_reads():
    with state_lock:
        return jsonify(state["plate_reads"])

@app.route('/api/spots', methods=['GET'])
def get_spots():
    return jsonify(load_spots())

@app.route('/api/spots', methods=['POST'])
def save_spot():
    data = request.get_json() or {}
    s_id = data.get("id")
    pts = data.get("points")
    if not s_id or not pts:
        return jsonify({"error": "Missing id or points"}), 400
    spots = load_spots()
    spots[s_id] = pts
    with open(SPOTS_PATH, "w", encoding="utf-8") as f:
        json.dump(spots, f, indent=2)
    return jsonify({"success": True, "spots": spots})

if __name__ == "__main__":
    t = threading.Thread(target=video_loop, daemon=True)
    t.start()
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
