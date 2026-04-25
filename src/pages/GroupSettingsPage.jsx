import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Save, AlertCircle } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'

export default function GroupSettingsPage() {
  const { group, setGroup, profile } = useOutletContext()
  const [name, setName] = useState(group.name || '')
  const [description, setDescription] = useState(group.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const isPrivileged = group.myRole === 'admin' || group.myRole === 'owner'

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: updateError } = await supabase
        .from('groups')
        .update({ name: name.trim(), description: description.trim() })
        .eq('id', group.id)

      if (updateError) throw updateError

      setGroup(prev => ({ ...prev, name: name.trim(), description: description.trim() }))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error(err)
      setError('Gagal menyimpan perubahan. Silakan coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  if (!isPrivileged) {
    return (
      <div className="p-6">
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-8 text-center max-w-md mx-auto mt-10">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4 opacity-80" />
          <h3 className="text-lg font-bold text-white mb-2">Akses Ditolak</h3>
          <p className="text-dark-300 text-sm">Hanya Admin atau Owner yang dapat mengubah profil grup ini.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 fade-in max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Profil Grup</h2>
        <p className="text-sm text-dark-400">Ubah nama dan deskripsi grup agar anggota tahu tujuan grup ini.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5 bg-dark-900 border border-dark-800 p-6 rounded-2xl">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-1.5">Nama Grup</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-950 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors"
            placeholder="Masukkan nama grup..."
            required
            maxLength={50}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-200 mb-1.5">Deskripsi / Bio</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2.5 bg-dark-950 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors resize-none h-32"
            placeholder="Tuliskan bio atau deskripsi grup..."
            maxLength={200}
          />
          <p className="text-xs text-dark-500 mt-1 text-right">{description.length}/200</p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          {success && <span className="text-sm text-green-400 font-medium">Tersimpan!</span>}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 gradient-bg rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </div>
      </form>
    </div>
  )
}
