"""Seed dummy users and winning hands so the landing hero has data to show.

Usage: .venv/bin/python scripts/seed_dummy_wins.py
"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import main  # noqa: E402


def t(name: str) -> str:
  return f"tiles/{name}.svg"


HANDS = {
    "dummy_thirteen": (13, "Thirteen Orphans", [
        "08-characters-1", "16-characters-9", "17-circles-1", "25-circles-9",
        "26-bamboos-1", "34-bamboos-9", "04-east-wind", "05-south-wind",
        "06-west-wind", "07-north-wind", "01-white-dragon", "02-green-dragon",
        "03-red-dragon", "03-red-dragon"]),
    "dummy_dragons": (8, "Big Three Dragons", [
        "01-white-dragon"] * 3 + ["02-green-dragon"] * 3 + ["03-red-dragon"] * 3 + [
        "09-characters-2", "10-characters-3", "11-characters-4",
        "12-characters-5", "12-characters-5"]),
    "dummy_bamboo": (7, "Pure Bamboo", [
        "26-bamboos-1", "27-bamboos-2", "28-bamboos-3", "29-bamboos-4",
        "30-bamboos-5", "31-bamboos-6", "32-bamboos-7", "33-bamboos-8",
        "34-bamboos-9", "28-bamboos-3", "28-bamboos-3", "28-bamboos-3",
        "30-bamboos-5", "30-bamboos-5"]),
    "dummy_circles": (3, "Mixed Sequence", [
        "17-circles-1", "18-circles-2", "19-circles-3", "21-circles-5",
        "22-circles-6", "23-circles-7", "08-characters-1", "09-characters-2",
        "10-characters-3", "26-bamboos-1", "27-bamboos-2", "28-bamboos-3",
        "04-east-wind", "04-east-wind"]),
}


def main_seed() -> None:
  import json
  main.init_db()
  now = datetime.datetime.now(datetime.timezone.utc).isoformat()
  with main.get_db_connection() as conn:
    for username, (fan, _label, tiles) in HANDS.items():
      assert len(tiles) == 14, username
      row = conn.execute(
          "SELECT id FROM users WHERE username = ?", (username,)
      ).fetchone()
      if row:
        user_id = row["id"]
      else:
        cur = conn.execute(
            """INSERT INTO users (username, password_hash, display_name, bio,
               avatar_url, is_admin, total_points, created_at)
               VALUES (?, ?, ?, '', ?, 0, 0, ?)""",
            (username, main.hash_password("dummy-not-for-login"),
             username.replace("dummy_", "Dummy ").title(),
             main.DEFAULT_AVATAR, now),
        )
        user_id = cur.lastrowid
      exists = conn.execute(
          "SELECT 1 FROM play_history WHERE user_id = ? AND fan_score = ?",
          (user_id, fan),
      ).fetchone()
      if exists:
        continue
      conn.execute(
          """INSERT INTO play_history (user_id, winning_hand, fan_score,
             point_delta, outcome, table_session, created_at)
             VALUES (?, ?, ?, ?, 'win', 'Dummy Seed', ?)""",
          (user_id, json.dumps([t(x) for x in tiles]), fan, fan * 2, now),
      )
    conn.commit()
  print("Seeded dummy wins.")


if __name__ == "__main__":
  main_seed()
