export default function Header({ count }) {
  return (
    <header className="header">
      <h1>Todos</h1>
      <span>{count} left</span>
    </header>
  )
}
