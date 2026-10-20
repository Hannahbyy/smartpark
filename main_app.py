import os
import json
import time
import threading
import cv2
import numpy as np
from flask import Flask, render_template, jsonify, request, Response, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

# Optional AI dependencies with graceful fallbacks
try:
    from ultralytics import YOLO
    from shapely.geometry import Polygon
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False

from registry import registry_store
from detection import plate_reader

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "mckl_smartpark_secure_session_2026")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPOTS_PATH = os.path.join(BASE_DIR, "spots.json")
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
CALIB_FRAME_PATH = os.path.join(STATIC_DIR, "calib_frame.jpg")
DEFAULT_VIDEO_PATH = os.path.join(BASE_DIR, "carpark_video.mp4")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Admin credentials (hashed)
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not ADMIN_PASSWORD or len(ADMIN_PASSWORD) < 12:
    raise RuntimeError("ADMIN_PASSWORD must be configured and at least 12 characters long")
ADMIN_PASSWORD_HASH = generate_password_hash(ADMIN_PASSWORD)

# Thread-safe global state
state_lock = threading.Lock()
state = {
    "source_type": "video",       # 'video' | 'camera'
    "source_path": DEFAULT_VIDEO_PATH,
    "camera_index": 0,
    "restart_requested": False,
    "latest_status": {},         # spot_id -> "empty" | "occupied" | "double-parked"
    "latest_details": {},        # spot_id -> {status, plate, owner_name, phone}
    "violations": [],            # [{id, bbox, type, description, timestamp}]
    "latest_jpeg": b"",
    "live_plate_reads": []       # [{plate, confidence, timestamp, spot_id, registered}]
}

# Debounce tracker for double parking: spot_pair -> count of consecutive cycles
straddle_debounce = {}

def load_parking_spots():
    if os.path.exists(SPOTS_PATH):
        try:
            with open(SPOTS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_parking_spots(data):
    with open(SPOTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def video_processing_thread():
    """Continuous video processing with YOLO, Double Parking debounce, and Plate OCR"""
    global state, straddle_debounce

    model = None
    if AI_AVAILABLE:
        try:
            model = YOLO("yolov8n.pt")
        except Exception as e:
            print(f"[SmartPark] Warning: YOLO could not be loaded ({e})")

    cap = None
    frame_count = 0

    while True:
        with state_lock:
            restart = state["restart_requested"]
            src_type = state["source_type"]
            src_path = state["source_path"]
            cam_idx = state["camera_index"]

        if cap is None or restart:
            if cap is not None:
                cap.release()
            if src_type == "camera":
                cap = cv2.VideoCapture(cam_idx)
            else:
                cap = cv2.VideoCapture(src_path if os.path.exists(src_path) else 0)
            
            with state_lock:
                state["restart_requested"] = False
            time.sleep(0.5)
            continue

        success, frame = cap.read()
        if not success:
            if src_type == "video":
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                time.sleep(0.1)
                continue

        # Save calibration frame if missing
        if not os.path.exists(CALIB_FRAME_PATH):
            cv2.imwrite(CALIB_FRAME_PATH, frame)

        # Run detection cycle roughly once per second (every 30 frames)
        if frame_count % 30 == 0:
            parking_spots = load_parking_spots()
            new_status = {k: "empty" for k in parking_spots.keys()}
            new_details = {k: {"status": "empty", "plate": None, "owner_name": None} for k in parking_spots.keys()}
            new_violations = []
            active_straddles = set()

            annotated_frame = frame.copy()

            if AI_AVAILABLE and model is not None:
                results = model.predict(source=frame, classes=[2, 3, 5, 7], conf=0.25, verbose=False)
                annotated_frame = results[0].plot()

                detected_cars = []
                for box in results[0].boxes:
                    x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                    poly = Polygon([(x1, y1), (x2, y1), (x2, y2), (x1, y2)])
                    detected_cars.append({"poly": poly, "bbox": [x1, y1, x2, y2]})

                # PHASE 2: Check each detected car against ALL spot polygons
                for car in detected_cars:
                    car_poly = car["poly"]
                    car_bbox = car["bbox"]
                    overlaps = []

                    for spot_id, points in parking_spots.items():
                        try:
                            spot_poly = Polygon(points)
                            if spot_poly.is_valid and not spot_poly.is_empty:
                                inter_area = spot_poly.intersection(car_poly).area
                                ratio = inter_area / spot_poly.area
                                if ratio > 0.15:
                                    overlaps.append((spot_id, ratio))
                        except Exception:
                            continue

                    # Read license plate (Phase 3)
                    plate_text, conf = plate_reader.read_plate(frame, car_bbox)
                    owner_record = registry_store.lookup_owner(plate_text) if conf > 0.5 else None

                    # Classification Rules:
                    if len(overlaps) == 0:
                        # 3. Out-of-bounds / blocking violation
                        new_violations.append({
                            "id": f"viol-{int(time.time()*1000)}-{len(new_violations)}",
                            "bbox": car_bbox,
                            "type": "out_of_bounds",
                            "description": "Vehicle blocking roadway / uncalibrated area",
                            "timestamp": time.strftime("%H:%M:%S")
                        })
                    elif len(overlaps) == 1:
                        # 1. Normal occupancy
                        spot_id, ratio = overlaps[0]
                        if ratio > 0.3:
                            new_status[spot_id] = "occupied"
                            new_details[spot_id] = {
                                "status": "occupied",
                                "plate": plate_text if conf > 0.5 else None,
                                "owner_name": owner_record["name"] if owner_record else None,
                                "phone": owner_record["phone"] if owner_record else None,
                                "vehicle_type": owner_record.get("vehicle_type", "car") if owner_record else None
                            }
                    else:
                        # 2. Straddling multiple spots -> Candidate for double-parking
                        straddle_key = tuple(sorted([s[0] for s in overlaps]))
                        active_straddles.add(straddle_key)
                        straddle_debounce[straddle_key] = straddle_debounce.get(straddle_key, 0) + 1

                        # Require 3 consecutive cycles to flag double-parked (debounce)
                        if straddle_debounce[straddle_key] >= 3:
                            for spot_id, _ in overlaps:
                                new_status[spot_id] = "double-parked"
                                new_details[spot_id] = {
                                    "status": "double-parked",
                                    "plate": plate_text if conf > 0.5 else None,
                                    "owner_name": owner_record["name"] if owner_record else None,
                                    "phone": owner_record["phone"] if owner_record else None,
                                    "vehicle_type": owner_record.get("vehicle_type", "car") if owner_record else None
                                }
                            new_violations.append({
                                "id": f"straddle-{int(time.time()*1000)}",
                                "bbox": car_bbox,
                                "type": "double_parking",
                                "spotIds": [s[0] for s in overlaps],
                                "description": f"Vehicle straddling spots: {', '.join([s[0] for s in overlaps])}",
                                "timestamp": time.strftime("%H:%M:%S")
                            })

                # Prune inactive straddles from debounce tracker
                for key in list(straddle_debounce.keys()):
                    if key not in active_straddles:
                        del straddle_debounce[key]

            # Encode annotated frame to JPEG for MJPEG stream
            ret, jpeg = cv2.imencode('.jpg', annotated_frame)
            with state_lock:
                state["latest_status"] = new_status
                state["latest_details"] = new_details
                state["violations"] = new_violations
                if ret:
                    state["latest_jpeg"] = jpeg.tobytes()

        frame_count += 1
        time.sleep(0.03)

# ----------------- PUBLIC ENDPOINTS -----------------

@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/get_status')
def get_status():
    """Returns latest spot statuses: empty | occupied | double-parked"""
    with state_lock:
        return jsonify(state["latest_status"])

@app.route('/get_violations')
def get_violations():
    """Returns out-of-bounds vehicles and double parking violations"""
    with state_lock:
        return jsonify(state["violations"])

@app.route('/get_details')
def get_details():
    """Public spot details: {spot_id: {status, plate, owner_name}}. Strictly NO phone numbers!"""
    with state_lock:
        public_data = {}
        for s_id, data in state["latest_details"].items():
            public_data[s_id] = {
                "status": data.get("status", "empty"),
                "plate": data.get("plate"),
                "owner_name": data.get("owner_name")
            }
        return jsonify(public_data)

@app.route('/video_feed')
def video_feed():
    """MJPEG stream of annotated detection frames"""
    def generate():
        while True:
            with state_lock:
                frame_data = state["latest_jpeg"]
            if frame_data:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
            time.sleep(0.08)
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

# ----------------- CALIBRATION & SOURCE API -----------------

@app.route('/api/spots', methods=['GET', 'POST'])
def api_spots():
    if request.method == 'GET':
        return jsonify(load_parking_spots())
    
    data = request.json or {}
    spot_id = data.get('id')
    points = data.get('points')
    if not spot_id or not points:
        return jsonify({"error": "Missing spot ID or points"}), 400
    
    spots = load_parking_spots()
    spots[spot_id] = points
    save_parking_spots(spots)
    return jsonify({"success": True, "spots": spots})

@app.route('/api/spots/<spot_id>', methods=['DELETE'])
def api_delete_spot(spot_id):
    spots = load_parking_spots()
    if spot_id in spots:
        del spots[spot_id]
        save_parking_spots(spots)
        return jsonify({"success": True, "spots": spots})
    return jsonify({"error": "Spot not found"}), 404

@app.route('/api/extract_frame', methods=['POST'])
def api_extract_frame():
    """Extracts a still frame from current active source and saves to calib_frame.jpg"""
    with state_lock:
        src_type = state["source_type"]
        src_path = state["source_path"]
        cam_idx = state["camera_index"]

    cap = cv2.VideoCapture(cam_idx if src_type == "camera" else src_path)
    success, frame = cap.read()
    cap.release()

    if success:
        cv2.imwrite(CALIB_FRAME_PATH, frame)
        return jsonify({"success": True, "url": "/static/calib_frame.jpg", "timestamp": time.time()})
    return jsonify({"error": "Failed to read frame from active source"}), 500

@app.route('/api/set_source', methods=['POST'])
def api_set_source():
    data = request.json or {}
    source_type = data.get("source_type", "video")
    source_path = data.get("source_path")
    camera_index = data.get("camera_index", 0)

    with state_lock:
        state["source_type"] = source_type
        if source_path:
            state["source_path"] = source_path
        state["camera_index"] = int(camera_index)
        state["restart_requested"] = True

    return jsonify({"success": True, "source_type": source_type})

@app.route('/api/upload_video', methods=['POST'])
def api_upload_video():
    if 'video' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['video']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    filename = secure_filename(file.filename)
    dest_path = os.path.join(UPLOADS_DIR, filename)
    file.save(dest_path)

    with state_lock:
        state["source_type"] = "video"
        state["source_path"] = dest_path
        state["restart_requested"] = True

    return jsonify({"success": True, "filename": filename, "path": dest_path})

# ----------------- ADMIN GATED ROUTES & REGISTRY -----------------

def is_admin():
    return session.get("is_admin") is True

@app.route('/admin')
def admin_page():
    return render_template('admin.html', is_admin=is_admin())

@app.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.json or {}
    password = data.get("password", "")
    if check_password_hash(ADMIN_PASSWORD_HASH, password):
        session["is_admin"] = True
        return jsonify({"success": True})
    return jsonify({"error": "Invalid password"}), 401

@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    session.pop("is_admin", None)
    return jsonify({"success": True})

@app.route('/admin/api/get_full_details')
def admin_get_full_details():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403
    with state_lock:
        return jsonify(state["latest_details"])

@app.route('/admin/registry', methods=['GET'])
def admin_registry_view():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403
    return jsonify(registry_store.load_registry())

@app.route('/admin/api/registry', methods=['POST'])
def admin_api_registry_save():
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403
    data = request.json or {}
    plate = data.get("plate", "")
    name = data.get("name", "")
    phone = data.get("phone", "")
    vehicle_type = data.get("vehicle_type", "car")
    registered_on = data.get("registered_on")

    if not plate or not name or not phone:
        return jsonify({"error": "Plate, Name, and Phone are required"}), 400

    record = registry_store.add_or_update_owner(plate, name, phone, vehicle_type, registered_on)
    return jsonify({"success": True, "record": record})

@app.route('/admin/api/registry/<plate>', methods=['DELETE'])
def admin_api_registry_delete(plate):
    if not is_admin():
        return jsonify({"error": "Unauthorized"}), 403
    if registry_store.remove_owner(plate):
        return jsonify({"success": True})
    return jsonify({"error": "Plate not found"}), 404

if __name__ == '__main__':
    t = threading.Thread(target=video_processing_thread, daemon=True)
    t.start()
    app.run(host='0.0.0.0', port=5000, debug=False)
