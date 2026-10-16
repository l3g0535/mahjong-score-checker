import base64
import datetime
import hashlib
import io
import json
import os
import secrets
import sqlite3
import traceback
from typing import List, Optional

from fastapi import Cookie, FastAPI, File, HTTPException, Query, Response, UploadFile
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


def get_admin_usernames() -> set:
  raw = os.environ.get("ADMIN_USERNAMES", "admin")
  return {u.strip().lower() for u in raw.split(",") if u.strip()}


def get_db_connection() -> sqlite3.Connection:
  conn = sqlite3.connect(get_db_path())
  conn.row_factory = sqlite3.Row
  return conn


def _ensure_column(
    conn: sqlite3.Connection, table: str, column: str, definition: str
) -> None:
  cols = [
      r["name"]
      for r in conn.execute(f"PRAGMA table_info({table})").fetchall()
  ]
  if column not in cols:
    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def sync_admin_users(conn: sqlite3.Connection) -> None:
  admin_usernames = get_admin_usernames()
  if not admin_usernames:
    return
  placeholders = ",".join("?" for _ in admin_usernames)
  conn.execute(
      f"UPDATE users SET is_admin = 1 WHERE LOWER(username) IN ({placeholders})",
      tuple(admin_usernames),
  )


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
          is_admin INTEGER NOT NULL DEFAULT 0,
          total_points INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
        """
    )
    _ensure_column(conn, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0")
    _ensure_column(conn, "users", "total_points", "INTEGER NOT NULL DEFAULT 0")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
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
          point_delta INTEGER NOT NULL DEFAULT 0,
          outcome TEXT NOT NULL DEFAULT 'win',
          table_session TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    _ensure_column(
        conn, "play_history", "point_delta", "INTEGER NOT NULL DEFAULT 0"
    )
    _ensure_column(
        conn, "play_history", "outcome", "TEXT NOT NULL DEFAULT 'win'"
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS lobbies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          num_tables INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_by INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          closed_at TEXT,
          FOREIGN KEY (created_by) REFERENCES users (id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS table_seats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lobby_id INTEGER NOT NULL,
          table_number INTEGER NOT NULL,
          seat_index INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          session_points INTEGER NOT NULL DEFAULT 0,
          joined_at TEXT NOT NULL,
          UNIQUE (lobby_id, table_number, seat_index),
          UNIQUE (lobby_id, user_id),
          FOREIGN KEY (lobby_id) REFERENCES lobbies (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pending_wins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lobby_id INTEGER NOT NULL,
          table_number INTEGER NOT NULL,
          winner_user_id INTEGER NOT NULL,
          winning_hand TEXT NOT NULL,
          fan_score INTEGER NOT NULL,
          win_type TEXT NOT NULL,
          discarder_user_id INTEGER,
          seat_wind TEXT NOT NULL DEFAULT '',
          table_wind TEXT NOT NULL DEFAULT '',
          hand_photo TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          reviewed_at TEXT,
          FOREIGN KEY (lobby_id) REFERENCES lobbies (id) ON DELETE CASCADE,
          FOREIGN KEY (winner_user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS lobby_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lobby_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          lobby_points INTEGER NOT NULL DEFAULT 0,
          hands_won INTEGER NOT NULL DEFAULT 0,
          hands_played INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          UNIQUE (lobby_id, user_id),
          FOREIGN KEY (lobby_id) REFERENCES lobbies (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    sync_admin_users(conn)
    conn.commit()


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


def get_active_lobby_row(conn: sqlite3.Connection) -> Optional[sqlite3.Row]:
  return conn.execute(
      "SELECT * FROM lobbies WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
  ).fetchone()


def get_user_active_seat(
    conn: sqlite3.Connection, user_id: int
) -> Optional[dict]:
  lobby = get_active_lobby_row(conn)
  if not lobby:
    return None
  seat = conn.execute(
      """
      SELECT lobby_id, table_number, seat_index, session_points, joined_at
      FROM table_seats
      WHERE lobby_id = ? AND user_id = ?
      """,
      (lobby["id"], user_id),
  ).fetchone()
  if not seat:
    return None
  return {
      "lobby_id": seat["lobby_id"],
      "lobby_name": lobby["name"],
      "table_number": seat["table_number"],
      "seat_index": seat["seat_index"],
      "session_points": seat["session_points"],
      "joined_at": seat["joined_at"],
  }


def build_user_payload(conn: sqlite3.Connection, user_row: sqlite3.Row) -> dict:
  history_rows = conn.execute(
      """
      SELECT id, winning_hand, fan_score, point_delta, outcome, table_session, created_at
      FROM play_history
      WHERE user_id = ?
      ORDER BY id DESC
      """,
      (user_row["id"],),
  ).fetchall()
  return {
      "id": user_row["id"],
      "username": user_row["username"],
      "display_name": user_row["display_name"],
      "bio": user_row["bio"],
      "avatar_url": user_row["avatar_url"],
      "is_admin": bool(user_row["is_admin"]),
      "total_points": int(user_row["total_points"]),
      "created_at": user_row["created_at"],
      "current_seat": get_user_active_seat(conn, user_row["id"]),
      "play_history": [dict(r) for r in history_rows],
  }


def get_current_user_row(
    conn: sqlite3.Connection, session_token: str = None
) -> sqlite3.Row:
  if not session_token:
    raise HTTPException(status_code=401, detail="Not authenticated")
  row = conn.execute(
      """
      SELECT u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
      """,
      (session_token,),
  ).fetchone()
  if not row:
    raise HTTPException(status_code=401, detail="Invalid or expired session")
  return row


def require_admin_user(
    conn: sqlite3.Connection, session_token: str = None
) -> sqlite3.Row:
  user_row = get_current_user_row(conn, session_token)
  if not user_row["is_admin"]:
    raise HTTPException(
        status_code=403, detail="Admin privileges are required."
    )
  return user_row


def build_lobby_leaderboard(
    conn: sqlite3.Connection, lobby_id: int
) -> List[dict]:
  rows = conn.execute(
      """
      SELECT ls.user_id, ls.lobby_points, ls.hands_won, ls.hands_played,
             u.username, u.display_name, u.avatar_url,
             ts.table_number AS current_table
      FROM lobby_scores ls
      JOIN users u ON u.id = ls.user_id
      LEFT JOIN table_seats ts ON ts.lobby_id = ls.lobby_id AND ts.user_id = ls.user_id
      WHERE ls.lobby_id = ?
      ORDER BY ls.lobby_points DESC, ls.hands_won DESC, LOWER(u.display_name) ASC, LOWER(u.username) ASC
      """,
      (lobby_id,),
  ).fetchall()

  leaderboard = []
  for idx, r in enumerate(rows, start=1):
    leaderboard.append({
        "rank": idx,
        "user_id": r["user_id"],
        "username": r["username"],
        "display_name": r["display_name"],
        "avatar_url": r["avatar_url"],
        "lobby_points": int(r["lobby_points"]),
        "hands_won": int(r["hands_won"]),
        "hands_played": int(r["hands_played"]),
        "current_table": r["current_table"],
    })
  return leaderboard


def build_lobby_payload(
    conn: sqlite3.Connection,
    lobby_row: Optional[sqlite3.Row],
    current_user_id: Optional[int] = None,
) -> dict:
  if not lobby_row:
    return {"lobby": None, "my_seat": None}

  lobby_id = lobby_row["id"]
  seat_rows = conn.execute(
      """
      SELECT ts.table_number, ts.seat_index, ts.user_id, ts.session_points, ts.joined_at,
             u.username, u.display_name, u.avatar_url, u.total_points
      FROM table_seats ts
      JOIN users u ON u.id = ts.user_id
      WHERE ts.lobby_id = ?
      ORDER BY ts.table_number ASC, ts.seat_index ASC
      """,
      (lobby_id,),
  ).fetchall()

  pending_rows = conn.execute(
      """
      SELECT pw.*, u.username AS winner_username, u.display_name AS winner_display_name,
             du.username AS discarder_username, du.display_name AS discarder_display_name
      FROM pending_wins pw
      JOIN users u ON u.id = pw.winner_user_id
      LEFT JOIN users du ON du.id = pw.discarder_user_id
      WHERE pw.lobby_id = ? AND pw.status = 'pending'
      ORDER BY pw.id ASC
      """,
      (lobby_id,),
  ).fetchall()

  seats_by_table = {t: [] for t in range(1, lobby_row["num_tables"] + 1)}
  my_seat = None

  for sr in seat_rows:
    seat_obj = {
        "seat_index": sr["seat_index"],
        "user_id": sr["user_id"],
        "username": sr["username"],
        "display_name": sr["display_name"],
        "avatar_url": sr["avatar_url"],
        "session_points": sr["session_points"],
        "total_points": sr["total_points"],
        "joined_at": sr["joined_at"],
    }
    if sr["table_number"] in seats_by_table:
      seats_by_table[sr["table_number"]].append(seat_obj)
    if current_user_id is not None and sr["user_id"] == current_user_id:
      my_seat = {
          "lobby_id": lobby_id,
          "lobby_name": lobby_row["name"],
          "table_number": sr["table_number"],
          "seat_index": sr["seat_index"],
          "session_points": sr["session_points"],
      }

  tables = []
  for t_num in range(1, lobby_row["num_tables"] + 1):
    t_seats = seats_by_table.get(t_num, [])
    t_pending = [
        {
            "id": pr["id"],
            "table_number": pr["table_number"],
            "winner_user_id": pr["winner_user_id"],
            "winner_display_name": pr["winner_display_name"],
            "fan_score": pr["fan_score"],
            "win_type": pr["win_type"],
            "discarder_user_id": pr["discarder_user_id"],
            "discarder_display_name": pr["discarder_display_name"],
            "created_at": pr["created_at"],
        }
        for pr in pending_rows
        if pr["table_number"] == t_num
    ]
    tables.append({
        "table_number": t_num,
        "join_url": f"/?table={t_num}",
        "max_seats": 4,
        "is_full": len(t_seats) >= 4,
        "seats": t_seats,
        "pending_wins": t_pending,
    })

  leaderboard = build_lobby_leaderboard(conn, lobby_id)

  return {
      "lobby": {
          "id": lobby_id,
          "name": lobby_row["name"],
          "num_tables": lobby_row["num_tables"],
          "is_active": bool(lobby_row["is_active"]),
          "created_at": lobby_row["created_at"],
          "tables": tables,
          "pending_wins_count": len(pending_rows),
          "leaderboard": leaderboard,
      },
      "my_seat": my_seat,
  }


def apply_win_payout(
    conn: sqlite3.Connection,
    lobby_row: sqlite3.Row,
    table_number: int,
    winner_user_id: int,
    winning_hand_list: List[str],
    fan_score: int,
    win_type: str,
    discarder_user_id: Optional[int],
    now: str,
) -> List[dict]:
  seat_rows = conn.execute(
      """
      SELECT ts.user_id, ts.session_points, u.username, u.display_name
      FROM table_seats ts
      JOIN users u ON u.id = ts.user_id
      WHERE ts.lobby_id = ? AND ts.table_number = ?
      ORDER BY ts.seat_index ASC
      """,
      (lobby_row["id"], table_number),
  ).fetchall()

  if len(seat_rows) < 4:
    raise HTTPException(
        status_code=400,
        detail="All 4 seats at the table must be filled to log a winning hand.",
    )

  seated_ids = {r["user_id"] for r in seat_rows}
  if winner_user_id not in seated_ids:
    raise HTTPException(
        status_code=400,
        detail="Winner must be seated at this table.",
    )

  other_ids = [uid for uid in seated_ids if uid != winner_user_id]
  deltas = {uid: 0 for uid in seated_ids}

  if win_type == "zimo":
    deltas[winner_user_id] = 3 * fan_score
    for uid in other_ids:
      deltas[uid] = -fan_score
  elif win_type == "discard":
    if discarder_user_id is None or discarder_user_id not in other_ids:
      raise HTTPException(
          status_code=400,
          detail="A valid seated opponent must be selected as the discarder.",
      )
    deltas[winner_user_id] = fan_score
    deltas[discarder_user_id] = -fan_score
  else:
    raise HTTPException(
        status_code=400,
        detail="win_type must be either 'zimo' or 'discard'.",
    )

  session_label = f"{lobby_row['name']} - Table {table_number}"
  hand_json = json.dumps(winning_hand_list)
  changes = []

  for sr in seat_rows:
    uid = sr["user_id"]
    delta = deltas[uid]
    won_inc = 1 if uid == winner_user_id else 0
    conn.execute(
        """
        INSERT OR IGNORE INTO lobby_scores (lobby_id, user_id, lobby_points, hands_won, hands_played, updated_at)
        VALUES (?, ?, 0, 0, 0, ?)
        """,
        (lobby_row["id"], uid, now),
    )
    conn.execute(
        """
        UPDATE lobby_scores
        SET lobby_points = lobby_points + ?,
            hands_won = hands_won + ?,
            hands_played = hands_played + 1,
            updated_at = ?
        WHERE lobby_id = ? AND user_id = ?
        """,
        (delta, won_inc, now, lobby_row["id"], uid),
    )
    if delta != 0:
      conn.execute(
          """
          UPDATE table_seats
          SET session_points = session_points + ?
          WHERE lobby_id = ? AND table_number = ? AND user_id = ?
          """,
          (delta, lobby_row["id"], table_number, uid),
      )
      conn.execute(
          "UPDATE users SET total_points = total_points + ? WHERE id = ?",
          (delta, uid),
      )
      outcome = "win" if uid == winner_user_id else "loss"
      conn.execute(
          """
          INSERT INTO play_history
            (user_id, winning_hand, fan_score, point_delta, outcome, table_session, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """,
          (uid, hand_json, fan_score, delta, outcome, session_label, now),
      )
    changes.append({
        "user_id": uid,
        "username": sr["username"],
        "display_name": sr["display_name"],
        "point_delta": delta,
        "new_session_points": sr["session_points"] + delta,
    })

  return changes


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


class LobbyCreateRequest(BaseModel):
  name: str = "Mahjong Event Lobby"
  num_tables: int


class WinSubmissionRequest(BaseModel):
  winning_hand: List[str]
  fan_score: int
  win_type: str
  discarder_user_id: Optional[int] = None
  seat_wind: str = "tiles/04-east-wind.svg"
  table_wind: str = "tiles/04-east-wind.svg"
  require_admin_review: bool = False
  hand_photo: str = ""
  scanned_by_camera: bool = False


class PendingWinReviewRequest(BaseModel):
  action: str
  fan_score: Optional[int] = None


@app.post("/api/signup", status_code=201)
def signup(creds: AuthCredentials, response: Response):
  init_db()
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
  is_admin = 1 if username.lower() in get_admin_usernames() else 0

  with get_db_connection() as conn:
    try:
      cursor = conn.execute(
          """
          INSERT INTO users (username, password_hash, display_name, bio, avatar_url, is_admin, total_points, created_at)
          VALUES (?, ?, ?, '', ?, ?, 0, ?)
          """,
          (username, pw_hash, username, DEFAULT_AVATAR, is_admin, now),
      )
    except sqlite3.IntegrityError:
      raise HTTPException(
          status_code=409, detail="Username is already taken."
      )
    user_id = cursor.lastrowid
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, now),
    )
    conn.commit()
    user_row = conn.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ).fetchone()
    payload = build_user_payload(conn, user_row)

  response.set_cookie(
      key=SESSION_COOKIE_NAME,
      value=token,
      httponly=True,
      samesite="lax",
      path="/",
  )
  return payload


@app.post("/api/login")
def login(creds: AuthCredentials, response: Response):
  init_db()
  username = creds.username.strip()
  password = creds.password
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()

  with get_db_connection() as conn:
    sync_admin_users(conn)
    user_row = conn.execute(
        "SELECT * FROM users WHERE username = ?", (username,)
    ).fetchone()
    if not user_row or not verify_password(password, user_row["password_hash"]):
      raise HTTPException(
          status_code=401, detail="Invalid username or password."
      )
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_row["id"], now),
    )
    conn.commit()
    user_row = conn.execute(
        "SELECT * FROM users WHERE id = ?", (user_row["id"],)
    ).fetchone()
    payload = build_user_payload(conn, user_row)

  response.set_cookie(
      key=SESSION_COOKIE_NAME,
      value=token,
      httponly=True,
      samesite="lax",
      path="/",
  )
  return payload


@app.post("/api/logout")
def logout(response: Response, mahjong_session: str = Cookie(default=None)):
  init_db()
  if mahjong_session:
    with get_db_connection() as conn:
      conn.execute("DELETE FROM sessions WHERE token = ?", (mahjong_session,))
      conn.commit()
  response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
  return {"status": "logged_out"}


@app.get("/api/me")
def get_me(mahjong_session: str = Cookie(default=None)):
  init_db()
  with get_db_connection() as conn:
    user_row = get_current_user_row(conn, mahjong_session)
    return build_user_payload(conn, user_row)


@app.put("/api/me")
def update_me(
    profile: ProfileUpdate, mahjong_session: str = Cookie(default=None)
):
  init_db()
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
    conn.commit()
    updated_row = conn.execute(
        "SELECT * FROM users WHERE id = ?", (user_row["id"],)
    ).fetchone()
    return build_user_payload(conn, updated_row)


@app.put("/api/me/password")
def update_password(
    pw_update: PasswordUpdate, mahjong_session: str = Cookie(default=None)
):
  init_db()
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
    conn.commit()
    return {"status": "password_updated"}


@app.get("/api/lobby/active")
def get_active_lobby(mahjong_session: str = Cookie(default=None)):
  init_db()
  with get_db_connection() as conn:
    current_user_id = None
    if mahjong_session:
      row = conn.execute(
          "SELECT user_id FROM sessions WHERE token = ?", (mahjong_session,)
      ).fetchone()
      if row:
        current_user_id = row["user_id"]
    lobby_row = get_active_lobby_row(conn)
    return build_lobby_payload(conn, lobby_row, current_user_id)


@app.get("/api/lobby/leaderboard")
def get_lobby_leaderboard():
  init_db()
  with get_db_connection() as conn:
    lobby_row = get_active_lobby_row(conn)
    if not lobby_row:
      return {"lobby_id": None, "lobby_name": None, "leaderboard": []}
    return {
        "lobby_id": lobby_row["id"],
        "lobby_name": lobby_row["name"],
        "leaderboard": build_lobby_leaderboard(conn, lobby_row["id"]),
    }


@app.post("/api/admin/lobby", status_code=201)
def create_lobby(
    req: LobbyCreateRequest, mahjong_session: str = Cookie(default=None)
):
  init_db()
  if req.num_tables < 1 or req.num_tables > 50:
    raise HTTPException(
        status_code=400, detail="Number of tables must be between 1 and 50."
    )
  lobby_name = req.name.strip() or "Mahjong Event Lobby"
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()

  with get_db_connection() as conn:
    admin_row = require_admin_user(conn, mahjong_session)
    conn.execute(
        "UPDATE lobbies SET is_active = 0, closed_at = ? WHERE is_active = 1",
        (now,),
    )
    cursor = conn.execute(
        """
        INSERT INTO lobbies (name, num_tables, is_active, created_by, created_at)
        VALUES (?, ?, 1, ?, ?)
        """,
        (lobby_name, req.num_tables, admin_row["id"], now),
    )
    conn.commit()
    lobby_row = conn.execute(
        "SELECT * FROM lobbies WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return build_lobby_payload(conn, lobby_row, admin_row["id"])


@app.post("/api/admin/lobby/close")
def close_active_lobby(mahjong_session: str = Cookie(default=None)):
  init_db()
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()
  with get_db_connection() as conn:
    require_admin_user(conn, mahjong_session)
    lobby_row = get_active_lobby_row(conn)
    if not lobby_row:
      raise HTTPException(status_code=404, detail="No active lobby to close.")
    conn.execute(
        "UPDATE lobbies SET is_active = 0, closed_at = ? WHERE id = ?",
        (now, lobby_row["id"]),
    )
    conn.commit()
    return {"status": "closed", "closed_lobby_id": lobby_row["id"]}


def name_winning_hand(tiles: List[str], fan: int) -> str:
  """Best-effort display name for a winning hand (limit hands, flushes, pongs)."""
  def kind(path: str) -> str:
    base = os.path.basename(path)
    num = int(base.split("-")[0])
    if num <= 3:
      return "dragon"
    if num <= 7:
      return "wind"
    if num <= 16:
      return "characters"
    if num <= 25:
      return "circles"
    if num <= 34:
      return "bamboos"
    return "flower"

  def rank(path: str) -> int:
    return int(path.rsplit("-", 1)[-1].split(".")[0])

  play = [t for t in tiles if kind(t) != "flower"]
  counts: dict = {}
  for t in play:
    counts[t] = counts.get(t, 0) + 1
  kinds = {kind(t) for t in play}
  honors = {"dragon", "wind"}
  suits = kinds - honors
  terminals_honors = {
      t for t in counts if kind(t) in honors or (kind(t) in suits and rank(t) in (1, 9))
  }
  dragon_pongs = sum(1 for t, c in counts.items() if kind(t) == "dragon" and c >= 3)
  dragon_pairs = sum(1 for t, c in counts.items() if kind(t) == "dragon" and c == 2)
  wind_pongs = sum(1 for t, c in counts.items() if kind(t) == "wind" and c >= 3)
  wind_pairs = sum(1 for t, c in counts.items() if kind(t) == "wind" and c == 2)

  if len(play) == 14 and len(counts) == 13 and set(counts) == terminals_honors:
    return "Thirteen Orphans"
  if kinds and kinds <= honors:
    return "All Honors"
  if wind_pongs == 4:
    return "Big Four Winds"
  if wind_pongs == 3 and wind_pairs == 1:
    return "Small Four Winds"
  if dragon_pongs == 3:
    return "Big Three Dragons"
  if dragon_pongs == 2 and dragon_pairs == 1:
    return "Small Three Dragons"
  if play and set(counts) == terminals_honors and not kinds & honors:
    return "All Terminals"
  if len(suits) == 1 and not kinds & honors:
    return "Full Flush"
  if len(suits) == 1 and kinds & honors:
    return "Half Flush"
  if len(counts) == 7 and all(c == 2 for c in counts.values()):
    return "Seven Pairs"
  if sorted(counts.values()).count(2) == 1 and all(c >= 3 for t, c in counts.items() if c != 2):
    return "All Pongs"
  return f"{fan} Fan Hand"


@app.get("/api/public/top-hand")
def get_top_hand():
  """Highest-fan logged win, shown on the landing page."""
  init_db()
  with get_db_connection() as conn:
    row = conn.execute(
        """
        SELECT ph.winning_hand, ph.fan_score, ph.created_at,
               u.display_name, u.avatar_url
        FROM play_history ph
        JOIN users u ON u.id = ph.user_id
        WHERE ph.outcome = 'win'
        ORDER BY ph.fan_score DESC, ph.id DESC
        LIMIT 1
        """
    ).fetchone()
  if not row:
    return {"top_hand": None}
  try:
    tiles = json.loads(row["winning_hand"])
  except (TypeError, ValueError):
    return {"top_hand": None}
  valid_tiles = [t for t in tiles if t in VALID_TILE_PATHS]
  return {
      "top_hand": {
          "tiles": valid_tiles,
          "hand_name": name_winning_hand(valid_tiles, int(row["fan_score"])),
          "fan_score": int(row["fan_score"]),
          "display_name": row["display_name"],
          "avatar_url": row["avatar_url"],
          "created_at": row["created_at"],
      }
  }


@app.post("/api/tables/{table_number}/join")
def join_table(
    table_number: int,
    source: str = Query(default=""),
    mahjong_session: str = Cookie(default=None),
):
  init_db()
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()
  with get_db_connection() as conn:
    user_row = get_current_user_row(conn, mahjong_session)
    # Players may only take a seat by scanning the table's QR/NFC tag.
    if source != "tag" and not user_row["is_admin"]:
      raise HTTPException(
          status_code=403,
          detail="Scan the QR code or NFC tag at the table to take a seat.",
      )
    lobby_row = get_active_lobby_row(conn)
    if not lobby_row:
      raise HTTPException(
          status_code=404, detail="No active lobby is currently open."
      )
    if table_number < 1 or table_number > lobby_row["num_tables"]:
      raise HTTPException(
          status_code=404,
          detail=f"Table {table_number} does not exist in the current lobby (Tables 1–{lobby_row['num_tables']}).",
      )

    existing_seat = conn.execute(
        "SELECT * FROM table_seats WHERE lobby_id = ? AND user_id = ?",
        (lobby_row["id"], user_row["id"]),
    ).fetchone()
    if existing_seat:
      if existing_seat["table_number"] == table_number:
        return build_lobby_payload(conn, lobby_row, user_row["id"])
      raise HTTPException(
          status_code=400,
          detail=f"You are already seated at Table {existing_seat['table_number']}. Leave your current table before joining another.",
      )

    taken_rows = conn.execute(
        "SELECT seat_index FROM table_seats WHERE lobby_id = ? AND table_number = ?",
        (lobby_row["id"], table_number),
    ).fetchall()
    taken_indices = {r["seat_index"] for r in taken_rows}
    if len(taken_indices) >= 4:
      raise HTTPException(
          status_code=409,
          detail=f"Table {table_number} is full (4/4 seats occupied).",
      )

    conn.execute(
        """
        INSERT OR IGNORE INTO lobby_scores (lobby_id, user_id, lobby_points, hands_won, hands_played, updated_at)
        VALUES (?, ?, 0, 0, 0, ?)
        """,
        (lobby_row["id"], user_row["id"], now),
    )
    score_row = conn.execute(
        "SELECT lobby_points FROM lobby_scores WHERE lobby_id = ? AND user_id = ?",
        (lobby_row["id"], user_row["id"]),
    ).fetchone()
    starting_session_pts = int(score_row["lobby_points"]) if score_row else 0

    next_seat = next(i for i in range(1, 5) if i not in taken_indices)
    conn.execute(
        """
        INSERT INTO table_seats (lobby_id, table_number, seat_index, user_id, session_points, joined_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            lobby_row["id"],
            table_number,
            next_seat,
            user_row["id"],
            starting_session_pts,
            now,
        ),
    )
    conn.commit()
    return build_lobby_payload(conn, lobby_row, user_row["id"])


@app.post("/api/tables/leave")
def leave_table(mahjong_session: str = Cookie(default=None)):
  init_db()
  with get_db_connection() as conn:
    user_row = get_current_user_row(conn, mahjong_session)
    lobby_row = get_active_lobby_row(conn)
    if not lobby_row:
      raise HTTPException(status_code=404, detail="No active lobby.")
    conn.execute(
        "DELETE FROM table_seats WHERE lobby_id = ? AND user_id = ?",
        (lobby_row["id"], user_row["id"]),
    )
    conn.commit()
    return build_lobby_payload(conn, lobby_row, user_row["id"])


@app.delete("/api/admin/tables/{table_number}/seats/{user_id}")
def admin_remove_seat(
    table_number: int,
    user_id: int,
    mahjong_session: str = Cookie(default=None),
):
  init_db()
  with get_db_connection() as conn:
    admin_row = require_admin_user(conn, mahjong_session)
    lobby_row = get_active_lobby_row(conn)
    if not lobby_row:
      raise HTTPException(status_code=404, detail="No active lobby.")
    conn.execute(
        """
        DELETE FROM table_seats
        WHERE lobby_id = ? AND table_number = ? AND user_id = ?
        """,
        (lobby_row["id"], table_number, user_id),
    )
    conn.commit()
    return build_lobby_payload(conn, lobby_row, admin_row["id"])


@app.post("/api/tables/{table_number}/wins")
def submit_table_win(
    table_number: int,
    req: WinSubmissionRequest,
    mahjong_session: str = Cookie(default=None),
):
  init_db()
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()
  if not req.scanned_by_camera:
    raise HTTPException(
        status_code=400,
        detail="You must scan your winning hand with the camera before logging a win.",
    )
  if not req.winning_hand or any(
      t not in VALID_TILE_PATHS for t in req.winning_hand
  ):
    raise HTTPException(
        status_code=400,
        detail="Winning hand must contain valid Mahjong tiles.",
    )
  if req.fan_score < 0 or req.fan_score > 18:
    raise HTTPException(
        status_code=400,
        detail="Fan score must be between 0 and 18.",
    )
  win_type = req.win_type.strip().lower()
  if win_type not in ("zimo", "discard"):
    raise HTTPException(
        status_code=400,
        detail="win_type must be either 'zimo' or 'discard'.",
    )

  with get_db_connection() as conn:
    user_row = get_current_user_row(conn, mahjong_session)
    lobby_row = get_active_lobby_row(conn)
    if not lobby_row:
      raise HTTPException(status_code=404, detail="No active lobby.")

    seat_rows = conn.execute(
        """
        SELECT ts.user_id, ts.session_points, u.username, u.display_name
        FROM table_seats ts
        JOIN users u ON u.id = ts.user_id
        WHERE ts.lobby_id = ? AND ts.table_number = ?
        ORDER BY ts.seat_index ASC
        """,
        (lobby_row["id"], table_number),
    ).fetchall()

    seated_ids = {r["user_id"] for r in seat_rows}
    if user_row["id"] not in seated_ids:
      raise HTTPException(
          status_code=403,
          detail=f"You are not seated at Table {table_number}.",
      )
    if len(seat_rows) < 4:
      raise HTTPException(
          status_code=400,
          detail=f"All 4 seats at Table {table_number} must be filled before logging a win (currently {len(seat_rows)}/4).",
      )

    other_ids = {uid for uid in seated_ids if uid != user_row["id"]}
    if win_type == "discard" and (
        req.discarder_user_id is None or req.discarder_user_id not in other_ids
    ):
      raise HTTPException(
          status_code=400,
          detail="Please select which seated opponent discarded the winning tile.",
      )

    if req.require_admin_review:
      cursor = conn.execute(
          """
          INSERT INTO pending_wins (
            lobby_id, table_number, winner_user_id, winning_hand, fan_score,
            win_type, discarder_user_id, seat_wind, table_wind, hand_photo,
            status, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
          """,
          (
              lobby_row["id"],
              table_number,
              user_row["id"],
              json.dumps(req.winning_hand),
              req.fan_score,
              win_type,
              req.discarder_user_id if win_type == "discard" else None,
              req.seat_wind,
              req.table_wind,
              req.hand_photo or "",
              now,
          ),
      )
      conn.commit()
      return {
          "status": "pending_review",
          "pending_win_id": cursor.lastrowid,
          "lobby_state": build_lobby_payload(conn, lobby_row, user_row["id"]),
      }

    point_changes = apply_win_payout(
        conn=conn,
        lobby_row=lobby_row,
        table_number=table_number,
        winner_user_id=user_row["id"],
        winning_hand_list=req.winning_hand,
        fan_score=req.fan_score,
        win_type=win_type,
        discarder_user_id=req.discarder_user_id,
        now=now,
    )
    conn.commit()
    return {
        "status": "logged",
        "point_changes": point_changes,
        "lobby_state": build_lobby_payload(conn, lobby_row, user_row["id"]),
    }


@app.get("/api/admin/pending-wins")
def list_pending_wins(mahjong_session: str = Cookie(default=None)):
  init_db()
  with get_db_connection() as conn:
    require_admin_user(conn, mahjong_session)
    lobby_row = get_active_lobby_row(conn)
    if not lobby_row:
      return {"pending_wins": []}
    rows = conn.execute(
        """
        SELECT pw.*,
               u.username AS winner_username, u.display_name AS winner_display_name,
               du.username AS discarder_username, du.display_name AS discarder_display_name
        FROM pending_wins pw
        JOIN users u ON u.id = pw.winner_user_id
        LEFT JOIN users du ON du.id = pw.discarder_user_id
        WHERE pw.lobby_id = ? AND pw.status = 'pending'
        ORDER BY pw.id ASC
        """,
        (lobby_row["id"],),
    ).fetchall()

    items = []
    for r in rows:
      try:
        tiles = json.loads(r["winning_hand"])
      except Exception:
        tiles = []
      fan = r["fan_score"]
      win_gain = 3 * fan if r["win_type"] == "zimo" else fan
      items.append({
          "id": r["id"],
          "lobby_id": r["lobby_id"],
          "lobby_name": lobby_row["name"],
          "table_number": r["table_number"],
          "winner_user_id": r["winner_user_id"],
          "winner_username": r["winner_username"],
          "winner_display_name": r["winner_display_name"],
          "winning_hand": tiles,
          "fan_score": fan,
          "win_type": r["win_type"],
          "discarder_user_id": r["discarder_user_id"],
          "discarder_username": r["discarder_username"],
          "discarder_display_name": r["discarder_display_name"],
          "seat_wind": r["seat_wind"],
          "table_wind": r["table_wind"],
          "hand_photo": r["hand_photo"],
          "suppose_winner_points": win_gain,
          "suppose_loser_points": -fan,
          "status": r["status"],
          "created_at": r["created_at"],
      })
    return {"pending_wins": items}


@app.post("/api/admin/pending-wins/{win_id}/review")
def review_pending_win(
    win_id: int,
    req: PendingWinReviewRequest,
    mahjong_session: str = Cookie(default=None),
):
  init_db()
  action = req.action.strip().lower()
  if action not in ("approve", "reject"):
    raise HTTPException(
        status_code=400, detail="action must be 'approve' or 'reject'."
    )
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()

  with get_db_connection() as conn:
    admin_row = require_admin_user(conn, mahjong_session)
    pw_row = conn.execute(
        "SELECT * FROM pending_wins WHERE id = ?", (win_id,)
    ).fetchone()
    if not pw_row:
      raise HTTPException(status_code=404, detail="Pending win not found.")
    if pw_row["status"] != "pending":
      raise HTTPException(
          status_code=400, detail="This submission has already been reviewed."
      )

    lobby_row = conn.execute(
        "SELECT * FROM lobbies WHERE id = ?", (pw_row["lobby_id"],)
    ).fetchone()
    if not lobby_row:
      raise HTTPException(status_code=404, detail="Lobby not found.")

    if action == "reject":
      conn.execute(
          "UPDATE pending_wins SET status = 'rejected', reviewed_at = ? WHERE id = ?",
          (now, win_id),
      )
      conn.commit()
      return {
          "status": "rejected",
          "win_id": win_id,
          "lobby_state": build_lobby_payload(conn, lobby_row, admin_row["id"]),
      }

    final_fan = (
        req.fan_score if req.fan_score is not None else pw_row["fan_score"]
    )
    if final_fan < 0 or final_fan > 18:
      raise HTTPException(
          status_code=400, detail="Fan score must be between 0 and 18."
      )

    try:
      tiles = json.loads(pw_row["winning_hand"])
    except Exception:
      tiles = []

    point_changes = apply_win_payout(
        conn=conn,
        lobby_row=lobby_row,
        table_number=pw_row["table_number"],
        winner_user_id=pw_row["winner_user_id"],
        winning_hand_list=tiles,
        fan_score=final_fan,
        win_type=pw_row["win_type"],
        discarder_user_id=pw_row["discarder_user_id"],
        now=now,
    )
    conn.execute(
        """
        UPDATE pending_wins
        SET status = 'approved', fan_score = ?, reviewed_at = ?
        WHERE id = ?
        """,
        (final_fan, now, win_id),
    )
    conn.commit()
    return {
        "status": "approved",
        "win_id": win_id,
        "point_changes": point_changes,
        "lobby_state": build_lobby_payload(conn, lobby_row, admin_row["id"]),
    }


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