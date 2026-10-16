import pytest
from fastapi.testclient import TestClient


SAMPLE_WINNING_HAND = [
    "tiles/08-characters-1.svg",
    "tiles/09-characters-2.svg",
    "tiles/10-characters-3.svg",
    "tiles/17-circles-1.svg",
    "tiles/18-circles-2.svg",
    "tiles/19-circles-3.svg",
    "tiles/26-bamboos-1.svg",
    "tiles/27-bamboos-2.svg",
    "tiles/28-bamboos-3.svg",
    "tiles/01-white-dragon.svg",
    "tiles/01-white-dragon.svg",
    "tiles/01-white-dragon.svg",
    "tiles/04-east-wind.svg",
    "tiles/04-east-wind.svg",
]


@pytest.fixture
def app_env(tmp_path, monkeypatch):
    db_path = tmp_path / "test_table_mahjong.db"
    monkeypatch.setenv("MAHJONG_DB_PATH", str(db_path))
    monkeypatch.setenv("ADMIN_USERNAMES", "admin,organizer")
    import main
    main.init_db()
    return main.app


def make_user_client(app, username: str, password: str = "secret123") -> TestClient:
    c = TestClient(app)
    res = c.post("/api/signup", json={"username": username, "password": password})
    assert res.status_code == 201, res.text
    return c


def test_admin_role_and_lobby_creation(app_env):
    admin_client = make_user_client(app_env, "admin")
    player_client = make_user_client(app_env, "player1")

    assert admin_client.get("/api/me").json()["is_admin"] is True
    assert player_client.get("/api/me").json()["is_admin"] is False

    # Normal player cannot open a lobby
    forbidden = player_client.post(
        "/api/admin/lobby", json={"name": "Unauthorized Lobby", "num_tables": 3}
    )
    assert forbidden.status_code == 403

    # Admin opens a lobby with 3 tables
    created = admin_client.post(
        "/api/admin/lobby", json={"name": "Club Championship", "num_tables": 3}
    )
    assert created.status_code == 201
    lobby = created.json()["lobby"]
    assert lobby["name"] == "Club Championship"
    assert lobby["num_tables"] == 3
    assert len(lobby["tables"]) == 3
    assert lobby["tables"][0]["join_url"] == "/?table=1"
    assert lobby["tables"][2]["join_url"] == "/?table=3"


def test_table_joining_4_seat_cap_and_leaving(app_env):
    admin = make_user_client(app_env, "admin")
    admin.post("/api/admin/lobby", json={"name": "Friday Session", "num_tables": 2})

    p1 = make_user_client(app_env, "player1")
    p2 = make_user_client(app_env, "player2")
    p3 = make_user_client(app_env, "player3")
    p4 = make_user_client(app_env, "player4")
    p5 = make_user_client(app_env, "player5")

    for idx, client in enumerate([p1, p2, p3, p4], start=1):
        res = client.post("/api/tables/1/join?source=tag")
        assert res.status_code == 200
        assert res.json()["my_seat"]["table_number"] == 1
        assert res.json()["my_seat"]["seat_index"] == idx

    # 5th player cannot join full Table 1
    full_res = p5.post("/api/tables/1/join?source=tag")
    assert full_res.status_code == 409

    # Player 1 cannot join Table 2 while still seated at Table 1
    switch_res = p1.post("/api/tables/2/join?source=tag")
    assert switch_res.status_code == 400

    # Player 2 leaves Table 1, freeing Seat 2 for Player 5
    leave_res = p2.post("/api/tables/leave")
    assert leave_res.status_code == 200
    assert leave_res.json()["my_seat"] is None

    join_p5 = p5.post("/api/tables/1/join?source=tag")
    assert join_p5.status_code == 200
    assert join_p5.json()["my_seat"]["seat_index"] == 2


def test_immediate_win_logging_zimo_and_discard_payouts(app_env):
    admin = make_user_client(app_env, "admin")
    admin.post("/api/admin/lobby", json={"name": "Night Event", "num_tables": 2})

    clients = [make_user_client(app_env, f"user{i}") for i in range(1, 5)]
    user_ids = [c.get("/api/me").json()["id"] for c in clients]

    # Seat first 3 players — win logging must fail until 4th seat is filled
    for c in clients[:3]:
        assert c.post("/api/tables/1/join?source=tag").status_code == 200

    not_full_win = clients[0].post(
        "/api/tables/1/wins",
        json={
            "winning_hand": SAMPLE_WINNING_HAND,
            "fan_score": 4,
            "win_type": "zimo",
            "scanned_by_camera": True,
        },
    )
    assert not_full_win.status_code == 400
    assert "4 seats" in not_full_win.json()["detail"]

    # Seat 4th player
    assert clients[3].post("/api/tables/1/join?source=tag").status_code == 200

    # Reject win if not scanned by camera
    unscanned_win = clients[0].post(
        "/api/tables/1/wins",
        json={
            "winning_hand": SAMPLE_WINNING_HAND,
            "fan_score": 4,
            "win_type": "zimo",
            "scanned_by_camera": False,
        },
    )
    assert unscanned_win.status_code == 400
    assert "camera" in unscanned_win.json()["detail"].lower()

    # 1. Self-Drawn (Zi Mo) win of 4 Fan by user1:
    # user1 gains +12, user2/3/4 each lose -4
    zimo_res = clients[0].post(
        "/api/tables/1/wins",
        json={
            "winning_hand": SAMPLE_WINNING_HAND,
            "fan_score": 4,
            "win_type": "zimo",
            "require_admin_review": False,
            "scanned_by_camera": True,
        },
    )
    assert zimo_res.status_code == 200
    assert zimo_res.json()["status"] == "logged"

    assert clients[0].get("/api/me").json()["total_points"] == 12
    assert clients[1].get("/api/me").json()["total_points"] == -4
    assert clients[2].get("/api/me").json()["total_points"] == -4
    assert clients[3].get("/api/me").json()["total_points"] == -4

    # 2. Discard win of 6 Fan by user2 off user3's discard:
    # user2 gains +6 (net +2), user3 loses -6 (net -10), user1 & user4 unchanged
    discard_res = clients[1].post(
        "/api/tables/1/wins",
        json={
            "winning_hand": SAMPLE_WINNING_HAND,
            "fan_score": 6,
            "win_type": "discard",
            "discarder_user_id": user_ids[2],
            "require_admin_review": False,
            "scanned_by_camera": True,
        },
    )
    assert discard_res.status_code == 200
    assert discard_res.json()["status"] == "logged"

    u1_me = clients[0].get("/api/me").json()
    u2_me = clients[1].get("/api/me").json()
    u3_me = clients[2].get("/api/me").json()
    u4_me = clients[3].get("/api/me").json()

    assert u1_me["total_points"] == 12
    assert u2_me["total_points"] == 2
    assert u3_me["total_points"] == -10
    assert u4_me["total_points"] == -4

    # Check play_history records for user3 (lost twice: -4 and -6)
    assert len(u3_me["play_history"]) == 2
    assert u3_me["play_history"][0]["point_delta"] == -6
    assert u3_me["play_history"][0]["outcome"] == "loss"
    assert u3_me["play_history"][1]["point_delta"] == -4


def test_granular_admin_review_checkbox_workflow(app_env):
    admin = make_user_client(app_env, "admin")
    admin.post("/api/admin/lobby", json={"name": "Finals Lobby", "num_tables": 1})

    clients = [make_user_client(app_env, f"finalist{i}") for i in range(1, 5)]
    user_ids = [c.get("/api/me").json()["id"] for c in clients]
    for c in clients:
        assert c.post("/api/tables/1/join?source=tag").status_code == 200

    # Finalist 1 submits a 5-Fan discard win off Finalist 2 WITH require_admin_review=True
    pending_res = clients[0].post(
        "/api/tables/1/wins",
        json={
            "winning_hand": SAMPLE_WINNING_HAND,
            "fan_score": 5,
            "win_type": "discard",
            "discarder_user_id": user_ids[1],
            "require_admin_review": True,
            "hand_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            "scanned_by_camera": True,
        },
    )
    assert pending_res.status_code == 200
    assert pending_res.json()["status"] == "pending_review"
    win_id = pending_res.json()["pending_win_id"]

    # Points are NOT changed yet while pending review
    assert clients[0].get("/api/me").json()["total_points"] == 0
    assert clients[1].get("/api/me").json()["total_points"] == 0

    # Admin fetches pending review queue
    queue_res = admin.get("/api/admin/pending-wins")
    assert queue_res.status_code == 200
    queue = queue_res.json()["pending_wins"]
    assert len(queue) == 1
    assert queue[0]["id"] == win_id
    assert queue[0]["suppose_winner_points"] == 5
    assert queue[0]["suppose_loser_points"] == -5
    assert queue[0]["hand_photo"].startswith("data:image/png;base64,")

    # Admin approves the hand and adjusts fan_score from 5 to 7
    approve_res = admin.post(
        f"/api/admin/pending-wins/{win_id}/review",
        json={"action": "approve", "fan_score": 7},
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

    # Points are now logged with the approved 7 Fan score
    assert clients[0].get("/api/me").json()["total_points"] == 7
    assert clients[1].get("/api/me").json()["total_points"] == -7
    assert len(admin.get("/api/admin/pending-wins").json()["pending_wins"]) == 0


def test_lobby_leaderboard_ordering_and_persistence_across_tables(app_env):
    admin = make_user_client(app_env, "admin")
    admin.post("/api/admin/lobby", json={"name": "Grand Prix Lobby", "num_tables": 2})

    # Create 8 players (4 on Table 1, 4 on Table 2) so we have > 5 players on the leaderboard
    t1_clients = [make_user_client(app_env, f"alpha{i}") for i in range(1, 5)]
    t2_clients = [make_user_client(app_env, f"bravo{i}") for i in range(1, 5)]
    t1_ids = [c.get("/api/me").json()["id"] for c in t1_clients]
    t2_ids = [c.get("/api/me").json()["id"] for c in t2_clients]

    for c in t1_clients:
        assert c.post("/api/tables/1/join?source=tag").status_code == 200
    for c in t2_clients:
        assert c.post("/api/tables/2/join?source=tag").status_code == 200

    # Table 1: alpha1 wins 8-Fan Zi Mo (+24 for alpha1; -8 for alpha2, alpha3, alpha4)
    assert (
        t1_clients[0]
        .post(
            "/api/tables/1/wins",
            json={
                "winning_hand": SAMPLE_WINNING_HAND,
                "fan_score": 8,
                "win_type": "zimo",
                "scanned_by_camera": True,
            },
        )
        .status_code
        == 200
    )

    # Table 2: bravo1 wins 5-Fan Discard off bravo2 (+5 for bravo1, -5 for bravo2, 0 for bravo3 & bravo4)
    assert (
        t2_clients[0]
        .post(
            "/api/tables/2/wins",
            json={
                "winning_hand": SAMPLE_WINNING_HAND,
                "fan_score": 5,
                "win_type": "discard",
                "discarder_user_id": t2_ids[1],
                "scanned_by_camera": True,
            },
        )
        .status_code
        == 200
    )

    # Table 1: alpha2 wins 3-Fan Discard off alpha4 (+3 for alpha2 -> net -5; -3 for alpha4 -> net -11)
    assert (
        t1_clients[1]
        .post(
            "/api/tables/1/wins",
            json={
                "winning_hand": SAMPLE_WINNING_HAND,
                "fan_score": 3,
                "win_type": "discard",
                "discarder_user_id": t1_ids[3],
                "scanned_by_camera": True,
            },
        )
        .status_code
        == 200
    )

    # Check leaderboard ordering via /api/lobby/leaderboard and /api/lobby/active
    lb_res = admin.get("/api/lobby/leaderboard")
    assert lb_res.status_code == 200
    leaderboard = lb_res.json()["leaderboard"]
    assert len(leaderboard) == 8

    # Verify strict descending point order:
    # 1. alpha1 (+24)
    # 2. bravo1 (+5)
    # 3. bravo3 (0)
    # 4. bravo4 (0)
    # 5. alpha2 (-5, 1 win)
    # 6. bravo2 (-5, 0 wins)
    # 7. alpha3 (-8)
    # 8. alpha4 (-11)
    points_list = [entry["lobby_points"] for entry in leaderboard]
    assert points_list == [24, 5, 0, 0, -5, -5, -8, -11]
    assert leaderboard[0]["username"] == "alpha1"
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[0]["hands_won"] == 1
    assert leaderboard[4]["username"] == "alpha2"
    assert leaderboard[5]["username"] == "bravo2"
    assert leaderboard[7]["username"] == "alpha4"
    assert leaderboard[7]["rank"] == 8

    # Verify score persistence when a player leaves a table and rejoins
    assert t1_clients[0].post("/api/tables/leave").status_code == 200
    lb_after_leave = admin.get("/api/lobby/active").json()["lobby"]["leaderboard"]
    assert lb_after_leave[0]["username"] == "alpha1"
    assert lb_after_leave[0]["lobby_points"] == 24
    assert lb_after_leave[0]["current_table"] is None

    rejoin_res = t1_clients[0].post("/api/tables/1/join?source=tag")
    assert rejoin_res.status_code == 200
    assert rejoin_res.json()["my_seat"]["session_points"] == 24


def test_join_requires_tag_scan_except_admin(app_env):
    admin = make_user_client(app_env, "admin")
    admin.post("/api/admin/lobby", json={"name": "Tag Night", "num_tables": 2})
    player = make_user_client(app_env, "player1")

    assert player.post("/api/tables/1/join").status_code == 403
    assert player.post("/api/tables/1/join?source=tag").status_code == 200
    assert admin.post("/api/tables/2/join").status_code == 200
