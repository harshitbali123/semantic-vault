import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Layout from './components/layout/Layout'

import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Document from './pages/Document'
import Connectors from './pages/Connectors'
import Search from './pages/Search'
import Chat from './pages/Chat'

function ProtectedLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* Public routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            }
          />

          <Route
            path="/documents"
            element={
              <ProtectedLayout>
                <Document />
              </ProtectedLayout>
            }
          />

          <Route
            path="/connectors"
            element={
              <ProtectedLayout>
                <Connectors />
              </ProtectedLayout>
            }
          />

          <Route
            path="/search"
            element={
              <ProtectedLayout>
                <Search />
              </ProtectedLayout>
            }
          />

          <Route
            path="/chat"
            element={
              <ProtectedLayout>
                <Chat />
              </ProtectedLayout>
            }
          />

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}