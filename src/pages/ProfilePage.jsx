import { useState, useRef } from 'react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import { Camera, Save, AlertCircle, CheckCircle, Phone, User, AtSign, FileText, Image as ImageIcon } from 'lucide-react'
import { maskPhone, validateFile } from '../lib/utils'

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const avatarInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    username: profile?.username || '',
    phone_number: profile?.phone_number || '',
    bio: profile?.bio || '',
    is_phone_searchable: profile?.is_phone_searchable ?? true,
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateFile(file, type === 'banner' ? 'chat' : 'avatar')
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setUploading(true)
    setError('')
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}/${type}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const updateData = type === 'banner' ? { banner_url: publicUrl } : { avatar_url: publicUrl }

      await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      await refreshProfile()
      setSuccess(`${type === 'banner' ? 'Banner' : 'Avatar'} berhasil diubah!`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(`Gagal upload ${type}: ` + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.full_name.trim()) return setError('Nama lengkap wajib diisi')
    if (!form.username.trim()) return setError('Username wajib diisi')
    if (form.username.length < 3) return setError('Username minimal 3 karakter')

    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          username: form.username.trim().toLowerCase(),
          phone_number: form.phone_number,
          bio: form.bio.trim(),
          is_phone_searchable: form.is_phone_searchable,
        })
        .eq('id', profile.id)

      if (updateError) {
        if (updateError.message?.includes('unique') || updateError.code === '23505') {
          throw new Error('Username sudah digunakan')
        }
        throw updateError
      }

      await refreshProfile()
      setSuccess('Profile berhasil disimpan!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Gagal menyimpan profile')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <LoadingSpinner size="lg" text="Memuat profile..." className="h-full" />

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>

      {/* Banner & Avatar section */}
      <div className="glass-card rounded-3xl overflow-hidden relative mb-6">
        {/* Banner */}
        <div className="h-32 md:h-48 relative bg-dark-900 group/banner">
          {profile.banner_url ? (
            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-900 via-indigo-900 to-purple-900"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent"></div>
          
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleImageUpload(e, 'banner')}
            className="hidden"
          />
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/banner:opacity-100 transition-opacity disabled:opacity-50"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800/80 text-white text-sm font-medium">
              <ImageIcon className="w-4 h-4" /> Ubah Banner
            </div>
          </button>
        </div>

        <div className="px-6 pb-6 relative z-10">
          <div className="flex flex-col items-center -mt-16 mb-4">
            <div className="relative group/avatar">
              <Avatar 
                src={profile.avatar_url} 
                name={profile.full_name} 
                size="2xl" 
                className="w-28 h-28 ring-4 ring-dark-950 shadow-xl"
              />
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleImageUpload(e, 'avatar')}
                className="hidden"
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity disabled:opacity-50"
              >
                {uploading ? <LoadingSpinner size="sm" /> : <Camera className="w-6 h-6 text-white" />}
              </button>
            </div>
            <h2 className="text-xl font-bold text-white mt-3">{profile.full_name}</h2>
            <p className="text-sm text-primary-400">@{profile.username}</p>
            {profile.phone_number && (
              <p className="text-xs text-dark-400 mt-1 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {maskPhone(profile.phone_number)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSave} className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5">Nama Lengkap</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => updateForm('full_name', e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors"
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
              className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5">Nomor HP</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => updateForm('phone_number', e.target.value)}
              placeholder="08123456789"
              className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-300 mb-1.5">Bio</label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-4 h-4 text-dark-500" />
            <textarea
              value={form.bio}
              onChange={(e) => updateForm('bio', e.target.value)}
              rows={3}
              placeholder="Ceritakan tentang dirimu..."
              className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-dark-800 rounded-xl">
          <div>
            <p className="text-sm font-medium text-white">Nomor HP bisa dicari</p>
            <p className="text-xs text-dark-500">Izinkan orang mencarimu lewat nomor HP</p>
          </div>
          <button
            type="button"
            onClick={() => updateForm('is_phone_searchable', !form.is_phone_searchable)}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              form.is_phone_searchable ? 'bg-primary-600' : 'bg-dark-600'
            }`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                form.is_phone_searchable ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>
    </div>
  )
}
