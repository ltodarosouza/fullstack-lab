import { useEffect, useState } from 'react'
import { listEvents, register } from './api.js'
import { DEFAULT_PARTICIPANTS, createUser, deleteUser, loadParticipants, saveParticipants, unregister } from './extras.js'

const slotsLabel = count => `${count} ${count === 1 ? 'vaga disponível' : 'vagas disponíveis'}`

const formatDate = value => {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

const CheckIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10" />
  <path d="M7.5 12.5l3 3 6-7" />
</svg>

const AlertIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="10" />
  <path d="M12 7.5v5.5M12 16.5v.01" />
</svg>

export default function App() {
  const [participants, setParticipants] = useState(loadParticipants)
  const [userId, setUserId] = useState(1)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [createError, setCreateError] = useState(null)
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

  const everyone = [...new Map(
    [...participants, ...events.flatMap(event => event.registered_users ?? [])].map(person => [person.id, person]),
  ).values()].sort((a, b) => a.id - b.id)
  const current = everyone.find(person => person.id === userId) ?? everyone[0]
  const isDefault = DEFAULT_PARTICIPANTS.some(person => person.id === current.id)

  function changeUser(id) {
    setUserId(id)
    setConfirmation(null)
    setActionError(null)
  }

  async function handleCreate(event) {
    event.preventDefault()
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const person = await createUser(name)
      const next = [...participants, person]
      setParticipants(next)
      saveParticipants(next)
      changeUser(person.id)
      setNewName('')
      setAdding(false)
    } catch (error) {
      setCreateError(error.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRemove() {
    if (sendingId !== null || removing) return
    setRemoving(true)
    setActionError(null)
    setConfirmation(null)
    try {
      await deleteUser(current.id)
      const next = participants.filter(person => person.id !== current.id)
      setParticipants(next)
      saveParticipants(next)
      setUserId(DEFAULT_PARTICIPANTS[0].id)
      setConfirmation(`${current.name} foi removido(a).`)
      setEvents(await listEvents())
    } catch (error) {
      setActionError(error.message)
    } finally {
      setRemoving(false)
    }
  }

  async function handleToggle(eventId, registered) {
    if (sendingId !== null) return
    setSendingId(eventId)
    setActionError(null)
    setConfirmation(null)
    try {
      if (registered) {
        await unregister(eventId, userId)
        setConfirmation('Inscrição cancelada.')
      } else {
        await register(eventId, userId)
        setConfirmation('Inscrição realizada com sucesso!')
      }
      setEvents(await listEvents())
    } catch (error) {
      setActionError(error.message)
    } finally {
      setSendingId(null)
    }
  }

  return <>
    <main className="page">
      <header className="masthead">
        <h1>Eventos</h1>
        <p>Encontre uma atividade e garanta sua vaga.</p>
      </header>

      <div className="user-picker">
        <label className="picker-field">
          <span className="picker-label">Participante de demonstração</span>
          <span className="picker-control">
            <span className="avatar" aria-hidden="true" data-tone={current.id % 4}>{current.name[0].toUpperCase()}</span>
            <select value={userId} onChange={event => changeUser(Number(event.target.value))}>
              {everyone.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </span>
        </label>
        {!adding && <button type="button" className="ghost" onClick={() => setAdding(true)}>Novo participante</button>}
        {!isDefault && <button type="button" className="ghost danger" disabled={removing} onClick={handleRemove}>
          {removing ? 'Removendo...' : `Remover ${current.name}`}
        </button>}
      </div>

      {adding && <form className="new-user" onSubmit={handleCreate}>
        <label>
          <span>Nome do participante</span>
          <input
            value={newName}
            onChange={event => setNewName(event.target.value)}
            maxLength={60}
            autoFocus
            placeholder="Como você quer ser chamado?"
          />
        </label>
        <button type="submit" disabled={creating || !newName.trim()}>{creating ? 'Criando...' : 'Adicionar'}</button>
        <button type="button" className="ghost" onClick={() => { setAdding(false); setCreateError(null) }}>Cancelar</button>
        {createError && <p role="alert" className="field-error">{createError}</p>}
      </form>}

      <div className="feedback">
        {confirmation && <p role="status" className="banner banner-ok" key={confirmation + sendingId}>
          <CheckIcon />{confirmation}
        </p>}
        {actionError && <p role="alert" className="banner banner-error" key={actionError + sendingId}>
          <AlertIcon />{actionError}
        </p>}
      </div>

      {loading && <>
        <p className="hint">Carregando eventos...</p>
        <div className="events" aria-hidden="true">
          <div className="card skeleton" />
          <div className="card skeleton" />
        </div>
      </>}
      {loadError && <p role="alert" className="banner banner-error"><AlertIcon />{loadError}</p>}
      {!loading && !loadError && events.length === 0 && <p className="hint empty">Nenhum evento disponível.</p>}

      <section aria-label="Lista de eventos" className="events">
        {events.map((event, index) => {
          const registered = (event.registered_users ?? []).some(person => person.id === userId)
          const full = event.available_slots <= 0 && !registered
          const sending = sendingId === event.id
          const taken = event.capacity - event.available_slots
          return <article
            className="card"
            data-full={full}
            data-sending={sending}
            key={event.id}
            style={{ '--i': index }}
          >
            <p className="date">{formatDate(event.date)}</p>
            {registered && <p className="chip"><CheckIcon />Inscrição confirmada</p>}
            <h2>{event.title}</h2>
            <div className="meter" aria-hidden="true">
              <span style={{ transform: `scaleX(${taken / event.capacity})` }} />
            </div>
            <p className="slots" key={event.available_slots}>
              {event.available_slots <= 0 ? 'Evento lotado' : slotsLabel(event.available_slots)}
            </p>
            {(event.registered_users ?? []).length > 0 && <p className="attendees">
              Inscritos: {event.registered_users.map(person => person.name).join(', ')}
            </p>}
            <button
              type="button"
              className={registered ? 'ghost' : undefined}
              disabled={full || sending}
              onClick={() => handleToggle(event.id, registered)}
            >{sending ? 'Enviando...' : registered ? 'Cancelar inscrição' : full ? 'Sem vagas' : 'Inscrever-se'}</button>
          </article>
        })}
      </section>
    </main>
  </>
}
