export default function TodoList({ todos, onToggle, onRemove }) {
  if (!todos.length) return <p className="empty">Nothing to do.</p>
  return (
    <ul className="list">
      {todos.map((t) => (
        <li key={t.id} className={t.done ? "done" : ""}>
          <label>
            <input type="checkbox" checked={t.done} onChange={() => onToggle(t.id)} />
            {t.text}
          </label>
          <button onClick={() => onRemove(t.id)} aria-label={`Delete ${t.text}`}>x</button>
        </li>
      ))}
    </ul>
  )
}
