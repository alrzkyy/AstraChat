import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { signIn, user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) return setError('Alamat email wajib diisi')
    if (!password) return setError('Kata sandi wajib diisi')

    setIsLoading(true)
    try {
      await signIn({ email: email.trim(), password })
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email atau kata sandi tidak valid'
        : err.message || 'Gagal masuk. Silakan coba lagi.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Left side - branding (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/30 via-dark-950 to-indigo-900/20" />
        <div className="relative z-10 text-center max-w-md">
          <img src="/logo.png" alt="AstraChat Logo" className="w-20 h-20 mx-auto mb-6 object-contain drop-shadow-2xl" />
          <h1 className="text-4xl font-bold mb-3 gradient-text">AstraChat</h1>
          <p className="text-dark-300 text-lg leading-relaxed">
            Platform chatting, berbagi catatan, dan kolaborasi dalam group belajar dengan aman dan mudah.
          </p>
          <div className="mt-8 space-y-3 text-left">
            {[
              'Chat Realtime End-to-End Encrypted',
              'Tersedia Berbagi Catatan & tugas info ke temanmu',
              'Terserdia gropup features',
              'Tersedia Reminder Tugas',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-dark-300">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <img src="/logo.png" alt="AstraChat Logo" className="w-12 h-12 object-contain drop-shadow-lg" />
            <span className="text-2xl font-bold gradient-text">AstraChat</span>
          </div>

          <div className="glass-card rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-1">Selamat Datang Kembali</h2>
            <p className="text-dark-400 mb-6">Masuk untuk melanjutkan</p>

            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Kata Sandi</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi Anda"
                    className="w-full pl-10 pr-12 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sedang Memproses...' : 'Masuk'}
              </button>
            </form>

            <p className="text-center text-sm text-dark-400 mt-6">
              Belum memiliki akun?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
