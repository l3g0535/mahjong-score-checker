import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test_mahjong.db"
    monkeypatch.setenv("MAHJONG_DB_PATH", str(db_path))
    import main
    main.init_db()
    with TestClient(main.app) as c:
        yield c


def test_signup_creates_account_and_persists_session(client):
    # Unauthenticated request to /api/me returns 401
    unauth = client.get("/api/me")
    assert unauth.status_code == 401

    # Sign up with valid credentials
    res = client.post(
        "/api/signup",
        json={"username": "eastwind", "password": "secretpassword"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "eastwind"
    assert data["display_name"] == "eastwind"
    assert data["bio"] == ""
    assert data["avatar_url"].startswith("tiles/")
    assert data["avatar_url"].endswith(".svg")
    assert "created_at" in data
    assert data["play_history"] == []

    # Session cookie allows fetching /api/me
    me_res = client.get("/api/me")
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["username"] == "eastwind"
    assert me_data["display_name"] == "eastwind"
    assert me_data["play_history"] == []


def test_signup_validation_rejects_short_or_duplicate_credentials(client):
    # Username shorter than 3 characters
    short_user = client.post(
        "/api/signup", json={"username": "ab", "password": "secretpassword"}
    )
    assert short_user.status_code == 400
    assert "3" in short_user.json()["detail"]

    # Password shorter than 6 characters
    short_pw = client.post(
        "/api/signup", json={"username": "southwind", "password": "12345"}
    )
    assert short_pw.status_code == 400
    assert "6" in short_pw.json()["detail"]

    # Duplicate username
    first = client.post(
        "/api/signup", json={"username": "southwind", "password": "secretpassword"}
    )
    assert first.status_code == 201

    dup = client.post(
        "/api/signup", json={"username": "southwind", "password": "anotherpassword"}
    )
    assert dup.status_code == 409
    assert "already" in dup.json()["detail"].lower()


def test_login_and_logout_lifecycle(client):
    client.post(
        "/api/signup", json={"username": "westwind", "password": "correctpassword"}
    )

    # Log out
    logout_res = client.post("/api/logout")
    assert logout_res.status_code == 200
    assert client.get("/api/me").status_code == 401

    # Login with wrong password -> 401
    bad_pw = client.post(
        "/api/login", json={"username": "westwind", "password": "wrongpassword"}
    )
    assert bad_pw.status_code == 401

    # Login with unknown user -> 401
    unknown_user = client.post(
        "/api/login", json={"username": "nobody", "password": "correctpassword"}
    )
    assert unknown_user.status_code == 401

    # Login with valid credentials -> 200 + active session
    login_res = client.post(
        "/api/login", json={"username": "westwind", "password": "correctpassword"}
    )
    assert login_res.status_code == 200
    assert login_res.json()["username"] == "westwind"

    me_res = client.get("/api/me")
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "westwind"


def test_update_profile_details_and_avatar_validation(client):
    import base64

    client.post(
        "/api/signup", json={"username": "northwind", "password": "secretpassword"}
    )

    # 1. Update display_name, bio, and valid Mahjong tile SVG avatar
    res = client.put(
        "/api/me",
        json={
            "display_name": "North Wind Master",
            "bio": "Loves All Pungs and Thirteen Orphans.",
            "avatar_url": "tiles/03-red-dragon.svg",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["display_name"] == "North Wind Master"
    assert body["bio"] == "Loves All Pungs and Thirteen Orphans."
    assert body["avatar_url"] == "tiles/03-red-dragon.svg"

    # 2. Update with valid custom PNG data URL
    small_png_b64 = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 64).decode("ascii")
    data_url = f"data:image/png;base64,{small_png_b64}"
    res_img = client.put(
        "/api/me",
        json={
            "display_name": "North Wind Master",
            "bio": "Custom avatar bio",
            "avatar_url": data_url,
        },
    )
    assert res_img.status_code == 200
    assert res_img.json()["avatar_url"] == data_url

    # 3. Reject unknown tile path or unsupported image MIME type
    bad_avatar = client.put(
        "/api/me",
        json={
            "display_name": "North Wind Master",
            "bio": "Bio",
            "avatar_url": "tiles/99-nonexistent.svg",
        },
    )
    assert bad_avatar.status_code == 400

    bad_mime = client.put(
        "/api/me",
        json={
            "display_name": "North Wind Master",
            "bio": "Bio",
            "avatar_url": f"data:image/gif;base64,{small_png_b64}",
        },
    )
    assert bad_mime.status_code == 400

    # 4. Reject image data URL larger than 2MB
    oversized_b64 = base64.b64encode(b"x" * (2 * 1024 * 1024 + 100)).decode("ascii")
    oversized = client.put(
        "/api/me",
        json={
            "display_name": "North Wind Master",
            "bio": "Bio",
            "avatar_url": f"data:image/jpeg;base64,{oversized_b64}",
        },
    )
    assert oversized.status_code == 400
    assert "2mb" in oversized.json()["detail"].lower()


def test_change_password_flow(client):
    client.post(
        "/api/signup", json={"username": "reddragon", "password": "oldpassword"}
    )

    # Reject short new password (< 6 chars)
    short_new = client.put(
        "/api/me/password",
        json={"new_password": "12345"},
    )
    assert short_new.status_code == 400

    # Valid password update
    ok_res = client.put(
        "/api/me/password",
        json={"new_password": "newpassword123"},
    )
    assert ok_res.status_code == 200

    # Log out and verify old password fails while new password succeeds
    client.post("/api/logout")
    old_login = client.post(
        "/api/login", json={"username": "reddragon", "password": "oldpassword"}
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/login", json={"username": "reddragon", "password": "newpassword123"}
    )
    assert new_login.status_code == 200
    assert new_login.json()["username"] == "reddragon"


def test_static_pages_serve_auth_and_profile_views(client):
    index_res = client.get("/lobby.html")
    assert index_res.status_code == 200
    assert "authModal" in index_res.text

    profile_res = client.get("/profile.html")
    assert profile_res.status_code == 200
    assert "Personal Profile" in profile_res.text
    assert "Play History" in profile_res.text





