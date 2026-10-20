import os
import cv2

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEO_PATH = os.path.join(BASE_DIR, "carpark_video.mp4")
OUTPUT_PATH = os.path.join(BASE_DIR, "calib_frame.jpg")
STATIC_OUTPUT = os.path.join(BASE_DIR, "static", "calib_frame.jpg")
PUBLIC_OUTPUT = os.path.join(BASE_DIR, "public", "assets", "carpark_calib_frame.jpg")

os.makedirs(os.path.join(BASE_DIR, "static"), exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "public", "assets"), exist_ok=True)

def extract():
    if not os.path.exists(VIDEO_PATH):
        # Check uploads directory fallback
        uploads_dir = os.path.join(BASE_DIR, "uploads")
        if os.path.exists(uploads_dir):
            mp4s = [f for f in os.listdir(uploads_dir) if f.endswith(".mp4")]
            if mp4s:
                src = os.path.join(uploads_dir, mp4s[0])
                print(f"[extract_frame] Found video in uploads: {src}")
                cap = cv2.VideoCapture(src)
            else:
                print(f"[extract_frame] Error: {VIDEO_PATH} not found!")
                return
        else:
            print(f"[extract_frame] Error: {VIDEO_PATH} not found!")
            return
    else:
        cap = cv2.VideoCapture(VIDEO_PATH)

    # Grab frame after 1 second (frame ~30)
    cap.set(cv2.CAP_PROP_POS_MSEC, 1000)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        print("[extract_frame] Failed to read frame from video.")
        return

    h, w = frame.shape[:2]
    print(f"[extract_frame] Extracted frame resolution: {w}x{h}")
    cv2.imwrite(OUTPUT_PATH, frame)
    cv2.imwrite(STATIC_OUTPUT, frame)
    cv2.imwrite(PUBLIC_OUTPUT, frame)
    print(f"[extract_frame] Saved clean frame to {OUTPUT_PATH}")

if __name__ == "__main__":
    extract()
