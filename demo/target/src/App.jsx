import { useState } from "react"
import Header from "./Header.jsx"
import TodoList from "./TodoList.jsx"

export default function App() {
  const [todos, setTodos] = useState([
    { id: 1, text: "Buy milk", done: false },
    { id: 2, text: "Write tests", done: true },
  ])
  const [text, setText] = useState("")

  function add(e) {
    e.preventDefault()
    if (!text.trim()) return
    setTodos([...todos, { id: Date.now(), text: text.trim(), done: false }])
    setText("")
  }

  function toggle(id) {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function remove(id) {
    setTodos(todos.filter((t) => t.id !== id))
  }

  return (
    <main className="app">
      <Header count={todos.filter((t) => !t.done).length} />
      <form onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing?" />
        <button type="submit">Add</button>
      </form>
      <TodoList todos={todos} onToggle={toggle} onRemove={remove} />
    </main>
  )
}
