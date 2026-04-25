import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Mail, Lock, Eye, EyeOff, User, Phone, AtSign, AlertCircle, CheckCircle } from 'lucide-react'
import { isValidIndonesianPhone, normalizePhone } from '../lib/utils'

export default function RegisterPage() {
  const { signUp, user, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const validate = () => {
    if (!form.fullName.trim()) return 'Nama lengkap wajib diisi'
    if (!form.username.trim()) return 'Username wajib diisi'
    if (form.username.length < 3) return 'Username minimal 3 karakter'
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return 'Username hanya boleh huruf, angka, dan underscore'
    if (!form.email.trim()) return 'Email wajib diisi'
    if (form.phone && !isValidIndonesianPhone(form.phone)) return 'Format nomor HP tidak valid (contoh: 08123456789)'
    if (!form.password) return 'Password wajib diisi'
    if (form.password.length < 6) return 'Password minimal 6 karakter'
    if (form.password !== form.confirmPassword) return 'Konfirmasi password tidak cocok'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) return setError(validationError)

    setIsLoading(true)
    try {
      const data = await signUp({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        phone: form.phone ? normalizePhone(form.phone) : '',
      })

      if (!data.session) {
        // Because we set up a DB trigger to auto-confirm, we can try logging in immediately
        try {
          await signIn({
            email: form.email.trim(),
            password: form.password,
          })
          setSuccess('success')
          setTimeout(() => navigate('/dashboard'), 1500)
        } catch (signInErr) {
          // Fallback if login fails
          setSuccess('confirmation_required')
        }
      } else {
        setSuccess('success')
        setTimeout(() => navigate('/dashboard'), 1500)
      }
    } catch (err) {
      if (err.message?.includes('already registered')) {
        setError('Email sudah terdaftar')
      } else if (err.message?.includes('username')) {
        setError('Username sudah digunakan')
      } else {
        setError(err.message || 'Gagal mendaftar')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success === 'confirmation_required') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center fade-in">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Verifikasi Email Diperlukan</h2>
          <p className="text-dark-400 mb-6">
            Kami telah mengirimkan link konfirmasi ke <strong>{form.email}</strong>.
            Silakan klik link tersebut untuk mengaktifkan akun Anda.
          </p>
          <Link to="/login" className="inline-block w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity">
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    )
  }

  if (success === 'success') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center fade-in">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Pendaftaran Berhasil</h2>
          <p className="text-dark-400">Mengalihkan ke beranda...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/logo.png" alt="AstraChat Logo" className="w-10 h-10 object-contain drop-shadow-lg" />
          <span className="text-xl font-bold gradient-text">AstraChat</span>
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-1">Buat Akun Baru</h2>
          <p className="text-dark-400 mb-6">Bergabung dan mulai berkolaborasi</p>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateForm('fullName', e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Username</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => updateForm('username', e.target.value.toLowerCase())}
                  placeholder="username"
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="nama@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Nomor HP <span className="text-dark-500">(opsional, untuk pencarian teman)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  placeholder="08123456789"
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
                  value={form.password}
                  onChange={(e) => updateForm('password', e.target.value)}
                  placeholder="Minimal 6 karakter"
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

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Konfirmasi Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => updateForm('confirmPassword', e.target.value)}
                  placeholder="Ulangi kata sandi"
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sedang Memproses...' : 'Daftar Sekarang'}
            </button>
          </form>

          <p className="text-center text-sm text-dark-400 mt-6">
            Sudah memiliki akun?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
              Masuk sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
