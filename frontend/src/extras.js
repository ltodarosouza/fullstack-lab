const STORAGE_KEY = 'trilha:participants'

export const DEFAULT_PARTICIPANTS = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Bruno' },
]

export function loadParticipants() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return [...DEFAULT_PARTICIPANTS, ...saved]
  } catch {
    return DEFAULT_PARTICIPANTS
  }
}

export function saveParticipants(participants) {
  try {
    const extra = participants.filter(person => !DEFAULT_PARTICIPANTS.some(item => item.id === person.id))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(extra))
  } catch {
    return
  }
}

async function send(path, options) {
  const response = await fetch(`/api${path}`, options)
  if (response.status === 204) return null
  const body = await response.json()
  if (!response.ok) {
    const detail = Array.isArray(body.detail) ? 'Informe um nome válido.' : body.detail
    throw new Error(detail || 'Não foi possível concluir a operação.')
  }
  return body
}

export const createUser = name => send('/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name }),
})

export const unregister = (eventId, userId) => send(`/events/${eventId}/registrations/${userId}`, {
  method: 'DELETE',
})

export const deleteUser = userId => send(`/users/${userId}`, { method: 'DELETE' })
