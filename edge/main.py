"""
ParkSmart Edge ANPR Service — FastAPI
POST /anpr : accepts base64 JPEG, returns {plate, confidence}
Uses EasyOCR for OCR + Indian plate regex validation.
Includes background job to purge captured images after 24h.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64, re, time, os, glob, hmac, hashlib, logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# ── Optional EasyOCR import (graceful fallback to simulation) ──────
try:
    import easyocr
    import numpy as np
    import cv2
    EASYOCR_AVAILABLE = True
    _reader = None   # lazy-init to avoid slow startup
    def get_reader():
        global _reader
        if _reader is None:
            _reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        return _reader
except ImportError:
    EASYOCR_AVAILABLE = False
    logging.warning("EasyOCR/OpenCV not installed — running in simulation mode")

# ── Config ─────────────────────────────────────────────────────────
CAPTURE_DIR = Path(os.environ.get("ANPR_CAPTURE_DIR", "./anpr_captures"))
CAPTURE_DIR.mkdir(parents=True, exist_ok=True)
PLATE_SECRET = os.environ.get("PLATE_HMAC_SECRET", "parksmart-hmac-secret-change-in-prod")
PURGE_AFTER_HOURS = int(os.environ.get("ANPR_PURGE_HOURS", "24"))

# Indian plate patterns
PLATE_PATTERNS = [
    re.compile(r'^[A-Z]{2}\d{2}[A-Z]{1,3}\d{1,4}$'),   # KA01AB1234
    re.compile(r'^\d{2}BH\d{4}[A-Z]{1,2}$'),             # 22BH1234AA
    re.compile(r'^[A-Z]{2}\d{2}[A-Z]{4}$'),              # TN22ABCD
]

VALID_STATE_CODES = {
    'AN','AP','AR','AS','BR','CG','CH','DD','DL','DN','GA','GJ','HR',
    'HP','JH','JK','KA','KL','LA','LD','MH','ML','MN','MP','MZ','NL',
    'OD','PB','PY','RJ','SK','TN','TR','TS','UK','UP','WB',
}

# Sample plates for simulation mode (cycles so consecutive calls differ)
SAMPLE_PLATES = ["KA01AB1234","MH12PQ5678","DL03CC9999","TN22XY4321","GJ05ZZ0001"]
_sim_idx = 0

app = FastAPI(
    title="ParkSmart Edge ANPR",
    description="License plate recognition with Indian plate validation",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ─────────────────────────────────────────────────────────
class ANPRRequest(BaseModel):
    frame: Optional[str] = None          # base64 JPEG
    parkingAreaId: str = ""
    gateId: str = "MAIN"
    # Legacy stream-url path (ignored in image-frame mode)
    cameraStreamUrl: Optional[str] = None

class ANPRResponse(BaseModel):
    plate: str
    confidence: float
    normalised: str
    valid: bool
    timestamp: float
    parkingAreaId: str
    gateId: str
    imageSaved: Optional[str] = None

# ── Helpers ────────────────────────────────────────────────────────
def normalise_plate(raw: str) -> str:
    return re.sub(r'[\s\-_]', '', raw).upper()

def validate_plate(raw: str) -> bool:
    p = normalise_plate(raw)
    is_bh = bool(re.match(r'^\d{2}BH', p))
    if not is_bh and p[:2] not in VALID_STATE_CODES:
        return False
    return any(pat.match(p) for pat in PLATE_PATTERNS)

def save_frame(frame_b64: str, prefix: str) -> Optional[str]:
    """Save base64 JPEG to disk; return relative path."""
    try:
        img_bytes = base64.b64decode(frame_b64)
        fname = f"{prefix}_{int(time.time()*1000)}.jpg"
        fpath = CAPTURE_DIR / fname
        fpath.write_bytes(img_bytes)
        return str(fpath)
    except Exception as e:
        logging.warning(f"Could not save ANPR frame: {e}")
        return None

def ocr_frame(frame_b64: str) -> tuple[str, float]:
    """
    Run EasyOCR on a base64 JPEG frame.
    Returns (plate_candidate, confidence).
    Falls back to simulation if EasyOCR unavailable.
    """
    global _sim_idx
    if not EASYOCR_AVAILABLE:
        plate = SAMPLE_PLATES[_sim_idx % len(SAMPLE_PLATES)]
        _sim_idx += 1
        return plate, 0.91

    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return "", 0.0

        reader = get_reader()
        results = reader.readtext(img)

        best_plate, best_conf = "", 0.0
        for (_bbox, text, conf) in results:
            candidate = normalise_plate(text)
            if validate_plate(candidate) and conf > best_conf:
                best_plate, best_conf = candidate, conf

        if not best_plate:
            # Take the highest-confidence raw text anyway (operator can confirm)
            if results:
                best_plate = normalise_plate(results[0][1])
                best_conf = results[0][2] * 0.5  # penalise unvalidated
        return best_plate, round(best_conf, 3)

    except Exception as e:
        logging.error(f"OCR error: {e}")
        return "", 0.0

# ── Background: purge images older than PURGE_AFTER_HOURS ─────────
def purge_old_captures():
    cutoff = time.time() - PURGE_AFTER_HOURS * 3600
    for fpath in CAPTURE_DIR.glob("*.jpg"):
        try:
            if fpath.stat().st_mtime < cutoff:
                fpath.unlink()
                logging.info(f"Purged ANPR capture: {fpath.name}")
        except Exception as e:
            logging.warning(f"Purge error {fpath}: {e}")

# ── Routes ─────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "ParkSmart Edge ANPR",
        "easyocr": EASYOCR_AVAILABLE,
        "mode": "OCR" if EASYOCR_AVAILABLE else "simulation",
        "timestamp": time.time(),
    }

@app.get("/health")
def health():
    return {"status": "healthy", "mode": "OCR" if EASYOCR_AVAILABLE else "simulation"}

@app.post("/anpr", response_model=ANPRResponse)
def scan_anpr(request: ANPRRequest, background_tasks: BackgroundTasks):
    """
    Accept a base64 JPEG frame, run OCR, return plate + confidence.
    confidence < 0.7 → client should show manual-confirm dialog.
    """
    background_tasks.add_task(purge_old_captures)

    plate, confidence = "", 0.0
    saved_path = None

    if request.frame:
        plate, confidence = ocr_frame(request.frame)
        saved_path = save_frame(request.frame, f"{request.parkingAreaId}_{request.gateId}")
    else:
        # No frame provided — simulation fallback
        global _sim_idx
        plate = SAMPLE_PLATES[_sim_idx % len(SAMPLE_PLATES)]
        _sim_idx += 1
        confidence = 0.88

    normalised = normalise_plate(plate) if plate else ""
    is_valid = validate_plate(normalised) if normalised else False

    return ANPRResponse(
        plate=plate,
        confidence=confidence,
        normalised=normalised,
        valid=is_valid,
        timestamp=time.time(),
        parkingAreaId=request.parkingAreaId,
        gateId=request.gateId,
        imageSaved=saved_path,
    )

# Legacy endpoint (backwards compat)
@app.post("/api/v1/anpr/scan")
def scan_anpr_legacy(request: ANPRRequest, background_tasks: BackgroundTasks):
    return scan_anpr(request, background_tasks)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
