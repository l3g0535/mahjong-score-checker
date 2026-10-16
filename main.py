import base64
import contextlib
import datetime
import hashlib
import io
import os
import secrets
import sqlite3
import traceback
from typing import Iterator

from fastapi import Cookie, FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel
from ultralytics import YOLO

app = FastAPI()

# Enable CORS so your frontend app can talk to this local server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSION_COOKIE_NAME = "mahjong_session"
SESSION_TTL_DAYS = 30
DEFAULT_AVATAR = "tiles/01-white-dragon.svg"
MAX_AVATAR_BYTES = 2 * 1024 * 1024
ALLOWED_DATA_URL_PREFIXES = (
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/jpg;base64,",
    "data:image/webp;base64,",
)

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
VALID_TILE_PATHS = set(CLASS_TO_SVG.values())


def get_db_path() -> str:
  return os.environ.get("MAHJONG_DB_PATH", "mahjong.db")


@contextlib.contextmanager
def get_db_connection() -> Iterator[sqlite3.Connection]:
  conn = sqlite3.connect(get_db_path())
  conn.row_factory = sqlite3.Row
  try:
    with conn:
      yield conn
  finally:
    conn.close()


def init_db() -> None:
  with get_db_connection() as conn:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          bio TEXT NOT NULL DEFAULT '',
          avatar_url TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS play_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          winning_hand TEXT NOT NULL,
          fan_score INTEGER NOT NULL,
          table_session TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )


def hash_password(password: str, salt: str = None) -> str:
  if salt is None:
    salt = secrets.token_hex(16)
  dk = hashlib.pbkdf2_hmac(
      "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
  )
  return f"{salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
  if "$" not in stored_hash:
    return False
  salt, _ = stored_hash.split("$", 1)
  return secrets.compare_digest(hash_password(password, salt), stored_hash)


def validate_avatar_url(avatar_url: str) -> str:
  avatar_url = avatar_url.strip()
  if avatar_url in VALID_TILE_PATHS:
    return avatar_url
  for prefix in ALLOWED_DATA_URL_PREFIXES:
    if avatar_url.startswith(prefix):
      b64_part = avatar_url[len(prefix) :]
      try:
        raw = base64.b64decode(b64_part, validate=True)
      except Exception:
        raise HTTPException(
            status_code=400, detail="Invalid base64 image data."
        )
      if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty image data.")
      if len(raw) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=400, detail="Avatar image must not exceed 2MB."
        )
      return avatar_url
  raise HTTPException(
      status_code=400,
      detail="Avatar must be a valid Mahjong tile SVG or a PNG/JPEG/WebP image up to 2MB.",
  )


def build_user_payload(conn: sqlite3.Connection, user_row: sqlite3.Row) -> dict:
  history_rows = conn.execute(
      """
      SELECT id, winning_hand, fan_score, table_session, created_at
      FROM play_history
      WHERE user_id = ?
      ORDER BY id DESC
      """,
      (user_row["id"],),
  ).fetchall()
  return {
      "username": user_row["username"],
      "display_name": user_row["display_name"],
      "bio": user_row["bio"],
      "avatar_url": user_row["avatar_url"],
      "created_at": user_row["created_at"],
      "play_history": [dict(r) for r in history_rows],
  }


def issue_session_cookie(
    conn: sqlite3.Connection, user_id: int, response: Response
) -> None:
  now_dt = datetime.datetime.now(datetime.timezone.utc)
  expires_dt = now_dt + datetime.timedelta(days=SESSION_TTL_DAYS)
  token = secrets.token_urlsafe(32)
  conn.execute(
      "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      (token, user_id, now_dt.isoformat(), expires_dt.isoformat()),
  )
  response.set_cookie(
      key=SESSION_COOKIE_NAME,
      value=token,
      httponly=True,
      samesite="lax",
      max_age=SESSION_TTL_DAYS * 86400,
      path="/",
  )


def get_current_user_row(
    conn: sqlite3.Connection, session_token: str = None
) -> sqlite3.Row:
  if not session_token:
    raise HTTPException(status_code=401, detail="Not authenticated")
  now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
  row = conn.execute(
      """
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?
      """,
      (session_token, now_iso),
  ).fetchone()
  if not row:
    raise HTTPException(status_code=401, detail="Invalid or expired session")
  return row


init_db()


class AuthCredentials(BaseModel):
  username: str
  password: str


class ProfileUpdate(BaseModel):
  display_name: str
  bio: str = ""
  avatar_url: str


class PasswordUpdate(BaseModel):
  new_password: str


@app.post("/api/signup", status_code=201)
def signup(creds: AuthCredentials, response: Response):
  username = creds.username.strip()
  password = creds.password
  if len(username) < 3:
    raise HTTPException(
        status_code=400, detail="Username must be at least 3 characters long."
    )
  if len(password) < 6:
    raise HTTPException(
        status_code=400, detail="Password must be at least 6 characters long."
    )
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()
  pw_hash = hash_password(password)

  with get_db_connection() as conn:
    try:
      cursor = conn.execute(
          """
          INSERT INTO users (username, password_hash, display_name, bio, avatar_url, created_at)
          VALUES (?, ?, ?, '', ?, ?)
          """,
          (username, pw_hash, username, DEFAULT_AVATAR, now),
      )
    except sqlite3.IntegrityError:
      raise HTTPException(
          status_code=409, detail="Username is already taken."
      )
    user_id = cursor.lastrowid
    issue_session_cookie(conn, user_id, response)
    user_row = conn.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    return build_user_payload(conn, user_row)


@app.post("/api/login")
def login(creds: AuthCredentials, response: Response):
  username = creds.username.strip()
  password = creds.password

  with get_db_connection() as conn:
    user_row = conn.execute(
        "SELECT * FROM users WHERE username = ?", (username,)
    ).fetchone()
    if not user_row or not verify_password(password, user_row["password_hash"]):
      raise HTTPException(
          status_code=401, detail="Invalid username or password."
      )
    issue_session_cookie(conn, user_row["id"], response)
    return build_user_payload(conn, user_row)


@app.post("/api/logout")
def logout(response: Response, mahjong_session: str = Cookie(default=None)):
  if mahjong_session:
    with get_db_connection() as conn:
      conn.execute("DELETE FROM sessions WHERE token = ?", (mahjong_session,))
  response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
  return {"status": "logged_out"}


@app.get("/api/me")
def get_me(mahjong_session: str = Cookie(default=None)):
  with get_db_connection() as conn:
    user_row = get_current_user_row(conn, mahjong_session)
    return build_user_payload(conn, user_row)


@app.put("/api/me")
def update_me(
    profile: ProfileUpdate, mahjong_session: str = Cookie(default=None)
):
  with get_db_connection() as conn:
    user_row = get_current_user_row(conn, mahjong_session)
    display_name = profile.display_name.strip() or user_row["username"]
    bio = profile.bio.strip()
    avatar_url = validate_avatar_url(profile.avatar_url)

    conn.execute(
        """
        UPDATE users
        SET display_name = ?, bio = ?, avatar_url = ?
        WHERE id = ?
        """,
        (display_name, bio, avatar_url, user_row["id"]),
    )
    updated_row = conn.execute(
        "SELECT * FROM users WHERE id = ?", (user_row["id"],)
    ).fetchone()
    return build_user_payload(conn, updated_row)


@app.put("/api/me/password")
def update_password(
    pw_update: PasswordUpdate, mahjong_session: str = Cookie(default=None)
):
  with get_db_connection() as conn:
    user_row = get_current_user_row(conn, mahjong_session)
    if len(pw_update.new_password) < 6:
      raise HTTPException(
          status_code=400,
          detail="New password must be at least 6 characters long.",
      )
    new_hash = hash_password(pw_update.new_password)
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (new_hash, user_row["id"]),
    )
    return {"status": "password_updated"}


# Load your custom trained YOLO model weights lazily on first scan
MODEL_PATH = "best.pt"
ONNX_PATH = "best.onnx"
_model = None


def get_yolo_model() -> YOLO:
  global _model
  if _model is None:
    if not os.path.exists(MODEL_PATH):
      raise RuntimeError(f"Model weights not found at {MODEL_PATH}")
    if not os.path.exists(ONNX_PATH):
      print("Exporting model to ONNX format...")
      temp_model = YOLO(MODEL_PATH)
      temp_model.export(format="onnx")
    _model = YOLO(MODEL_PATH)
  return _model


@app.post("/scan-hand")
async def scan_hand(file: UploadFile = File(...)):
  try:
    yolo_model = get_yolo_model()
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")

    # Run YOLO inference with optimized image size
    results = yolo_model(
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
        cls_name = yolo_model.names[cls_id]
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