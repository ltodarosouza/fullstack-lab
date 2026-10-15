-- Retorne o nome de cada participante do evento informado, em ordem de nome.
-- Consulte users e registrations; o teste fornece o parâmetro à consulta.
SELECT users.name
FROM registrations
JOIN users ON users.id = registrations.user_id
WHERE registrations.event_id = :event_id
ORDER BY users.name;
