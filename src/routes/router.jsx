import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from '../components/AuthProvider'
import { CallProvider } from '../components/CallProvider'
import AppLayout from '../layouts/AppLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import DashboardPage from '../pages/DashboardPage'
import ProfilePage from '../pages/ProfilePage'
import FriendsPage from '../pages/FriendsPage'
import GroupsPage from '../pages/GroupsPage'
import GroupChatPage from '../pages/GroupChatPage'
import GroupNotesPage from '../pages/GroupNotesPage'
import GroupMembersPage from '../pages/GroupMembersPage'
import GroupSettingsPage from '../pages/GroupSettingsPage'
import UserProfilePage from '../pages/UserProfilePage'
import SettingsPage from '../pages/SettingsPage'
import GroupLayout from '../layouts/GroupLayout'
import DirectMessagesPage from '../pages/DirectMessagesPage'
import DirectChatPage from '../pages/DirectChatPage'

// Root layout that provides AuthProvider + CallProvider context to all routes
function RootLayout() {
  return (
    <AuthProvider>
      <CallProvider>
        <Outlet />
      </CallProvider>
    </AuthProvider>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            path: 'profile',
            element: <ProfilePage />,
          },
          {
            path: 'user/:username',
            element: <UserProfilePage />,
          },
          {
            path: 'friends',
            element: <FriendsPage />,
          },
          {
            path: 'groups',
            element: <GroupsPage />,
          },
          {
            path: 'groups/:id',
            element: <GroupLayout />,
            children: [
              { index: true, element: <Navigate to="chat" replace /> },
              { path: 'chat', element: <GroupChatPage /> },
              { path: 'notes', element: <GroupNotesPage /> },
              { path: 'members', element: <GroupMembersPage /> },
              { path: 'settings', element: <GroupSettingsPage /> },
            ]
          },
          {
            path: 'dm',
            element: <DirectMessagesPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
      {
        // DM chat gets its own full-screen route (like group chat)
        path: '/dm/:conversationId',
        element: (
          <ProtectedRoute>
            <AppLayout hideNav />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <DirectChatPage />,
          },
        ],
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
])
