from fastapi.testclient import TestClient

from app.main import create_app


EVENT = {"title": "Oficina", "date": "2026-10-10", "capacity": 1}


def test_create_participant_and_register():
    with TestClient(create_app()) as api:
        created = api.post("/users", json={"name": "  Carla  "})
        assert created.status_code == 201
        assert created.json()["name"] == "Carla"
        user_id = created.json()["id"]
        event_id = api.post("/events", json=EVENT).json()["id"]
        assert api.post(f"/events/{event_id}/registrations", json={"user_id": user_id}).status_code == 201
        assert api.get(f"/events/{event_id}").json()["registered_users"] == [{"id": user_id, "name": "Carla"}]


def test_create_participant_rejects_blank_name():
    with TestClient(create_app()) as api:
        assert api.post("/users", json={"name": ""}).status_code == 422
        assert api.post("/users", json={"name": "   "}).status_code == 422


def test_unregister_frees_the_slot():
    with TestClient(create_app()) as api:
        user_id = api.post("/users", json={"name": "Davi"}).json()["id"]
        event_id = api.post("/events", json=EVENT).json()["id"]
        api.post(f"/events/{event_id}/registrations", json={"user_id": user_id})
        assert api.get(f"/events/{event_id}").json()["available_slots"] == 0
        assert api.delete(f"/events/{event_id}/registrations/{user_id}").status_code == 204
        event = api.get(f"/events/{event_id}").json()
        assert event["available_slots"] == 1
        assert event["registered_users"] == []


def test_unregister_missing_registration_returns_404():
    with TestClient(create_app()) as api:
        event_id = api.post("/events", json=EVENT).json()["id"]
        assert api.delete(f"/events/{event_id}/registrations/1").status_code == 404


def test_delete_created_participant_frees_their_slots():
    with TestClient(create_app()) as api:
        user_id = api.post("/users", json={"name": "Eva"}).json()["id"]
        event_id = api.post("/events", json=EVENT).json()["id"]
        api.post(f"/events/{event_id}/registrations", json={"user_id": user_id})
        assert api.delete(f"/users/{user_id}").status_code == 204
        event = api.get(f"/events/{event_id}").json()
        assert event["available_slots"] == 1
        assert event["registered_users"] == []
        assert api.delete(f"/users/{user_id}").status_code == 404


def test_seed_participants_cannot_be_deleted():
    from sqlalchemy.orm import Session

    from app.models import User

    app = create_app()
    with Session(app.state.engine) as session:
        session.add(User(id=1, name="Ana", email="ana@example.org"))
        session.commit()
    with TestClient(app) as api:
        assert api.delete("/users/1").status_code == 403
