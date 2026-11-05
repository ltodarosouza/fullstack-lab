import { useEffect, useState } from 'react'
import { listEvents, register } from './api.js'

const slotsLabel = count => `${count} ${count === 1 ? 'vaga disponível' : 'vagas disponíveis'}`

export default function App() {
  const [userId, setUserId] = useState(1)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [sendingId, setSendingId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    listEvents()
      .then(setEvents)
      .catch(() => setLoadError('Não foi possível carregar os eventos.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleRegister(eventId) {
    if (sendingId !== null) return
    setSendingId(eventId)
    setActionError(null)
    setConfirmation(null)
    try {
      await register(eventId, userId)
      setConfirmation('Inscrição realizada com sucesso!')
      setEvents(await listEvents())
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSendingId(null)
    }
  }

  return <main className="page">
    <header>
      <p className="eyebrow">Trilha · Laboratório Full Stack</p>
      <h1>Eventos</h1>
      <p>Encontre uma atividade e garanta sua vaga.</p>
    </header>

    <label className="user-picker">Participante de demonstração
      <select value={userId} onChange={event => setUserId(Number(event.target.value))}>
        <option value="1">Pessoa 1</option>
        <option value="2">Pessoa 2</option>
      </select>
    </label>

    {confirmation && <p role="status">{confirmation}</p>}
    {actionError && <p role="alert">{actionError}</p>}

    {loading && <p>Carregando eventos...</p>}
    {loadError && <p role="alert">{loadError}</p>}
    {!loading && !loadError && events.length === 0 && <p>Nenhum evento disponível.</p>}

    <section aria-label="Lista de eventos" className="events">
      {events.map(event => <article className="card" key={event.id}>
        <p className="date">{event.date}</p>
        <h2>{event.title}</h2>
        <p>{event.available_slots > 0 ? slotsLabel(event.available_slots) : 'Evento lotado'}</p>
        <button
          type="button"
          disabled={event.available_slots <= 0 || sendingId === event.id}
          onClick={() => handleRegister(event.id)}
        >Inscrever-se</button>
      </article>)}
    </section>
  </main>
}
