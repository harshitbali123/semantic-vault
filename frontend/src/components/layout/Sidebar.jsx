import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, FileText, Cable,
  Search, MessageSquare, LogOut
} from 'lucide-react'

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/documents',  icon: FileText,         label: 'Documents'  },
  { to: '/connectors', icon: Cable,            label: 'Connectors' },
  { to: '/search',     icon: Search,           label: 'Search'     },
  { to: '/chat',       icon: MessageSquare,    label: 'Ask AI'     },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside className="w-60 bg-gradient-to-b from-gray-900 via-gray-950 to-black border-r border-gray-800 h-screen flex flex-col fixed left-0 top-0">
      {/* Logo / profile */}
      <div className="p-5 border-b border-gray-800 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
          {user?.email?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="truncate">
          <h1 className="text-white font-bold text-lg">KnowledgeAI</h1>
          <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[9rem]">{user?.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:text-white hover:bg-gray-800 w-full transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}