import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import SplashScreen from './SplashScreen'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <SplashScreen />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
