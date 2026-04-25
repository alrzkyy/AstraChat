import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import Avatar from '../components/Avatar'
import {
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
  Users,
  UserSearch,
  StickyNote,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/groups', icon: MessageSquare, label: 'Groups' },
  { to: '/dm', icon: MessageCircle, label: 'Chat' },
  { to: '/friends', icon: UserSearch, label: 'Teman' },
  { to: '/settings', icon: Settings, label: 'Pengaturan' },
]

export default function AppLayout({ hideNav = false }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Global listener: mark messages as "delivered" (2 gray checks) when app is open
  useEffect(() => {
    if (!profile?.id) return

    // Mark existing 'sent' messages to me as 'delivered' since I am now online
    supabase
      .from('direct_messages')
      .update({ status: 'delivered' })
      .eq('status', 'sent')
      .neq('sender_id', profile.id)
      .then()

    const channel = supabase
      .channel('global-dm-receipts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages'
      }, (payload) => {
        const newMsg = payload.new
        // If message is sent by someone else and we received it globally
        if (newMsg.sender_id !== profile.id && newMsg.status === 'sent') {
          const isOnChatPage = location.pathname === `/dm/${newMsg.conversation_id}`
          // If we are NOT on the chat page, mark as delivered.
          // (If we ARE on the chat page, DirectChatPage will mark it as read).
          if (!isOnChatPage) {
            supabase.from('direct_messages').update({ status: 'delivered' }).eq('id', newMsg.id).then()
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, location.pathname])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Full screen mode for chat pages
  if (hideNav) {
    return (
      <div className="flex h-screen bg-dark-950">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    )
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pt-6 pb-4">
        <img src="/logo.png" alt="AstraChat" className="w-9 h-9 object-contain drop-shadow-md" />
        <span className="text-lg font-bold gradient-text">AstraChat</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary-600/20 text-primary-400 shadow-sm'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User profile section */}
      <div className="p-3 border-t border-dark-800">
        <button
          onClick={() => { navigate('/profile'); setSidebarOpen(false) }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left hover:bg-dark-800 transition-colors group"
        >
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-dark-500 truncate">@{profile?.username}</p>
          </div>
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-red-400 hover:bg-dark-800 transition-colors mt-1"
        >
          <LogOut className="w-5 h-5" />
          <span>Keluar</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-dark-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-dark-900 border-r border-dark-800">
        <NavContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-dark-900 flex flex-col slide-up">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-5 p-1.5 text-dark-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-dark-900 border-b border-dark-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-dark-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AstraChat" className="w-6 h-6 object-contain" />
            <span className="font-bold text-white">AstraChat</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex items-center justify-around bg-dark-900 border-t border-dark-800 px-2 py-1 safe-bottom">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                  isActive ? 'text-primary-400' : 'text-dark-500'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </main>
    </div>
  )
}
