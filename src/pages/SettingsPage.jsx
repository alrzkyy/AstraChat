import { useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import { Shield, Key, Trash2, AlertCircle, CheckCircle, Lock } from 'lucide-react'
import { loadOrCreateKey, generateKey, saveKeyToStorage, exportKey } from '../lib/encryption'

export default function SettingsPage() {
  const { profile, signOut } = useAuth()
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')
  const [deleting, setDeleting] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 3000)
  }

  const regenerateKey = async () => {
    if (!confirm('Buat ulang kunci enkripsi? Pesan lama tidak bisa didekripsi lagi.')) return
    try {
      const key = await generateKey()
      await saveKeyToStorage(key)
      showToast('Kunci enkripsi berhasil dibuat ulang')
    } catch (err) {
      showToast('Gagal membuat kunci: ' + err.message, 'error')
    }
  }

  const exportEncKey = async () => {
    try {
      const key = await loadOrCreateKey()
      const exported = await exportKey(key)
      navigator.clipboard.writeText(exported)
      showToast('Kunci enkripsi disalin ke clipboard')
    } catch (err) {
      showToast('Gagal export kunci: ' + err.message, 'error')
    }
  }

  const deleteAccount = async () => {
    if (!confirm('HAPUS AKUN? Semua data kamu akan hilang permanen. Tindakan ini tidak bisa dibatalkan.')) return
    if (!confirm('Yakin? Ketik HAPUS di prompt berikutnya.')) return

    setDeleting(true)
    try {
      // Delete profile (cascade will handle related data)
      await supabase.from('profiles').delete().eq('id', profile.id)
      await signOut()
    } catch (err) {
      showToast('Gagal menghapus akun: ' + err.message, 'error')
      setDeleting(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Pengaturan</h1>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 p-3 border rounded-xl text-sm shadow-lg slide-up ${
          toastType === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-dark-800 border-dark-700 text-white'
        }`}>
          {toastType === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-green-400" />}
          {toast}
        </div>
      )}

      {/* Encryption */}
      <div className="glass-card rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Keamanan & Privasi</h2>
            <p className="text-xs text-dark-400">Pengaturan kunci enkripsi pesan</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-dark-800 rounded-xl">
            <div>
              <p className="text-sm text-white">Status</p>
              <p className="text-xs text-dark-500">AES-256-GCM Aktif</p>
            </div>
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <Lock className="w-3 h-3" /> Terenkripsi
            </span>
          </div>

          <button
            onClick={exportEncKey}
            className="w-full flex items-center gap-3 p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors text-left"
          >
            <Key className="w-4 h-4 text-primary-400" />
            <div>
              <p className="text-sm text-white">Export Kunci</p>
              <p className="text-xs text-dark-500">Salin kunci enkripsi ke clipboard</p>
            </div>
          </button>

          <button
            onClick={regenerateKey}
            className="w-full flex items-center gap-3 p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors text-left"
          >
            <Shield className="w-4 h-4 text-yellow-400" />
            <div>
              <p className="text-sm text-white">Buat Ulang Kunci</p>
              <p className="text-xs text-dark-500">Pesan lama tidak bisa didekripsi</p>
            </div>
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="glass-card rounded-2xl p-6 mb-4">
        <h2 className="text-lg font-semibold text-white mb-4">Informasi Aplikasi</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-dark-300">
            <span>Versi</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between text-dark-300">
            <span>Platform</span>
            <span className="text-white">Web</span>
          </div>
          <div className="flex justify-between text-dark-300">
            <span>Enkripsi</span>
            <span className="text-green-400">AES-256-GCM</span>
          </div>
          <div className="flex justify-between text-dark-300">
            <span>Backend</span>
            <span className="text-white">Supabase</span>
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className="glass-card rounded-2xl p-6 border border-red-500/20">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Manajemen Akun</h2>
        <button
          onClick={deleteAccount}
          disabled={deleting}
          className="w-full flex items-center gap-3 p-3 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors text-left"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
          <div>
            <p className="text-sm text-red-400 font-medium">{deleting ? 'Menghapus...' : 'Hapus Akun'}</p>
            <p className="text-xs text-dark-500">Semua data akan dihapus permanen</p>
          </div>
        </button>
      </div>
    </div>
  )
}
