import os
import json
import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_PATH = os.path.join(BASE_DIR, "calib_frame.jpg")
STATIC_IMG = os.path.join(BASE_DIR, "static", "calib_frame.jpg")
SPOTS_PATH = os.path.join(BASE_DIR, "spots.json")

# 55 spots defined on dashboard: spot-0 through spot-54
TOTAL_SPOTS = 55
DASHBOARD_SPOT_IDS = [f"spot-{i}" for i in range(TOTAL_SPOTS)]

current_points = []
spots_data = {}
active_spot_id = "spot-0"

def load_spots():
    global spots_data
    if os.path.exists(SPOTS_PATH):
        try:
            with open(SPOTS_PATH, "r", encoding="utf-8") as f:
                spots_data = json.load(f)
        except Exception:
            spots_data = {}
    else:
        spots_data = {}

def save_spots():
    with open(SPOTS_PATH, "w", encoding="utf-8") as f:
        json.dump(spots_data, f, indent=2)
    print(f"[calibrate] Saved {len(spots_data)} spots to {SPOTS_PATH}")

def find_next_uncalibrated():
    for s_id in DASHBOARD_SPOT_IDS:
        if s_id not in spots_data:
            return s_id
    return DASHBOARD_SPOT_IDS[0]

def mouse_callback(event, x, y, flags, param):
    global current_points, active_spot_id, spots_data
    if event == cv2.EVENT_LBUTTONDOWN:
        if len(current_points) < 4:
            current_points.append([int(x), int(y)])
            print(f"[calibrate] Corner {len(current_points)} for {active_spot_id}: ({x}, {y})")

            if len(current_points) == 4:
                spots_data[active_spot_id] = list(current_points)
                save_spots()
                print(f"[calibrate] Completed {active_spot_id}! Points: {current_points}")
                current_points = []
                # Advance to next uncalibrated spot
                active_spot_id = find_next_uncalibrated()
                print(f"[calibrate] Now calibrating next spot: {active_spot_id}")

def main():
    global active_spot_id, current_points
    load_spots()

    img_file = IMAGE_PATH if os.path.exists(IMAGE_PATH) else STATIC_IMG
    if not os.path.exists(img_file):
        print(f"[calibrate] Error: {img_file} not found. Run extract_frame.py first!")
        return

    base_frame = cv2.imread(img_file)
    if base_frame is None:
        print(f"[calibrate] Failed to load {img_file}")
        return

    h, w = base_frame.shape[:2]
    print(f"[calibrate] Frame size: {w}x{h}")
    active_spot_id = find_next_uncalibrated()

    window_name = f"MCKL Spot Calibration (Frame: {w}x{h})"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(window_name, mouse_callback)

    print("\n" + "="*60)
    print(" MCKL PARKING CALIBRATION TOOL")
    print(f" Total Spots on Dashboard: {TOTAL_SPOTS} (spot-0 to spot-54)")
    print(f" Currently Calibrated: {len(spots_data)} / {TOTAL_SPOTS}")
    print(" Instructions:")
    print("  - Left click 4 corners of the active spot clockwise.")
    print("  - Press 'u' to undo the last clicked corner.")
    print("  - Press 'n' to skip to the next spot ID.")
    print("  - Press 'd' to delete the current active spot.")
    print("  - Press 'q' or ESC to save and exit.")
    print("="*60 + "\n")

    while True:
        display_frame = base_frame.copy()

        # Draw already calibrated spots in green
        for s_id, pts in spots_data.items():
            if len(pts) == 4:
                pts_np = np.array(pts, np.int32).reshape((-1, 1, 2))
                cv2.polylines(display_frame, [pts_np], isClosed=True, color=(0, 255, 0), thickness=2)
                cv2.putText(display_frame, s_id, (pts[0][0], pts[0][1] - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # Draw active clicks in progress
        for i, pt in enumerate(current_points):
            cv2.circle(display_frame, tuple(pt), 5, (0, 165, 255), -1)
            cv2.putText(display_frame, f"C{i+1}", (pt[0] + 8, pt[1] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 165, 255), 2)

        if len(current_points) > 1:
            pts_prog = np.array(current_points, np.int32).reshape((-1, 1, 2))
            cv2.polylines(display_frame, [pts_prog], isClosed=False, color=(0, 165, 255), thickness=2)

        # Status overlay on top left
        cv2.rectangle(display_frame, (10, 10), (520, 80), (20, 20, 20), -1)
        cv2.putText(display_frame, f"Target: {active_spot_id} | Corners: {len(current_points)}/4",
                    (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(display_frame, f"Calibrated: {len(spots_data)}/{TOTAL_SPOTS} | [u]ndo [n]ext [d]el [q]uit",
                    (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

        cv2.imshow(window_name, display_frame)
        key = cv2.waitKey(20) & 0xFF

        if key in (27, ord('q')):
            break
        elif key == ord('u'):
            if current_points:
                current_points.pop()
                print(f"[calibrate] Undid corner. {len(current_points)} remaining.")
        elif key == ord('n'):
            current_points = []
            curr_idx = int(active_spot_id.replace("spot-", "")) if active_spot_id.startswith("spot-") else 0
            active_spot_id = f"spot-{(curr_idx + 1) % TOTAL_SPOTS}"
            print(f"[calibrate] Switched to {active_spot_id}")
        elif key == ord('d'):
            if active_spot_id in spots_data:
                del spots_data[active_spot_id]
                save_spots()
                print(f"[calibrate] Deleted calibration for {active_spot_id}")

    cv2.destroyAllWindows()
    save_spots()

if __name__ == "__main__":
    main()
