import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div style={{ padding: 32 }}>
      <h1>Dashboard</h1>
      <p>Logged in as: <strong>{user?.email}</strong></p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}