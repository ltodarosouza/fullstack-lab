"""API de eventos usada em todas as etapas do projeto."""

from datetime import date
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import Base, make_engine
from app.db_session import get_session
from app.models import Event, Registration, User
from app.registrations import router as registrations_router


class EventInput(BaseModel):
    """Dados enviados pelo cliente ao cadastrar um evento."""

    title: str = Field(min_length=1)
    date: date
    capacity: int = Field(gt=0)


DEMO_EMAIL_DOMAIN = "@demo.local"


class UserInput(BaseModel):
    """Nome enviado ao criar um participante de demonstração."""

    name: str = Field(min_length=1, max_length=60)


def serialize_event(session: Session, event: Event) -> dict:
    taken = session.scalar(
        select(func.count()).select_from(Registration).where(Registration.event_id == event.id)
    )
    registered = session.execute(
        select(User.id, User.name)
        .join(Registration, Registration.user_id == User.id)
        .where(Registration.event_id == event.id)
        .order_by(Registration.id)
    ).all()
    return {
        "id": event.id,
        "title": event.title,
        "date": event.date.isoformat(),
        "capacity": event.capacity,
        "available_slots": event.capacity - taken,
        "registered_users": [{"id": user_id, "name": name} for user_id, name in registered],
    }


def create_app(database_url: str = "sqlite://") -> FastAPI:
    """Cria uma API; sem URL, usa um banco em memória isolado."""
    app = FastAPI(title="Eventos do Trilha")
    app.state.engine = make_engine(database_url)
    Base.metadata.create_all(app.state.engine)
    app.include_router(registrations_router)

    @app.get("/events")
    def list_events(session: Session = Depends(get_session)):
        events = session.scalars(select(Event).order_by(Event.id)).all()
        return [serialize_event(session, event) for event in events]

    @app.get("/events/{event_id}")
    def get_event(event_id: int, session: Session = Depends(get_session)):
        event = session.get(Event, event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Evento não encontrado")
        return serialize_event(session, event)

    @app.post("/events", status_code=201)
    def create_event(data: EventInput, session: Session = Depends(get_session)):
        event = Event(**data.model_dump())
        session.add(event)
        session.commit()
        return serialize_event(session, event)

    @app.post("/users", status_code=201)
    def create_user(data: UserInput, session: Session = Depends(get_session)):
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Informe um nome")
        user = User(name=name, email=f"{uuid4().hex[:10]}{DEMO_EMAIL_DOMAIN}")
        session.add(user)
        session.commit()
        return {"id": user.id, "name": user.name}

    @app.delete("/users/{user_id}", status_code=204)
    def delete_user(user_id: int, session: Session = Depends(get_session)):
        user = session.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="Participante não encontrado")
        if not user.email.endswith(DEMO_EMAIL_DOMAIN):
            raise HTTPException(status_code=403, detail="Este participante não pode ser removido")
        session.execute(delete(Registration).where(Registration.user_id == user_id))
        session.delete(user)
        session.commit()

    return app


app = create_app("sqlite:///events.db")
