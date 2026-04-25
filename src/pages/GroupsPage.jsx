import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import SearchInput from '../components/SearchInput'
import {
  Plus, Users, Hash, LogIn, Copy, CheckCircle, AlertCircle,
  MessageSquare, StickyNote, Settings, Trash2, LogOut
} from 'lucide-react'

export default function GroupsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [toast, setToast] = useState('')
  const [toastType, setToastType] = useState('success')

  // Create form
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)

  // Join form
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    if (profile) loadGroups()
  }, [profile])

  const showToastMsg = (msg, type = 'success') => {
    setToast(msg)
    setToastType(type)
    setTimeout(() => setToast(''), 3000)
  }

  const loadGroups = async () => {
    try {
      const { data } = await supabase
        .from('group_members')
        .select(`
          role,
          groups (
            id, name, description, avatar_url, invite_code, created_by, created_at
          )
        `)
        .eq('user_id', profile.id)

      const groupsList = (data || [])
        .filter(m => m.groups)
        .map(m => ({ ...m.groups, role: m.role }))
      setGroups(groupsList)
    } catch (err) {
      console.error('Load groups error:', err)
    } finally {
      setLoading(false)
    }
  }

  const createGroup = async (e) => {
    e.preventDefault()
    if (!createForm.name.trim()) return

    setCreating(true)
    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: createForm.name.trim(),
          description: createForm.description.trim(),
          created_by: profile.id,
        })
        .select()
        .single()

      if (groupError) throw groupError

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: profile.id,
          role: 'owner',
        })

      if (memberError) throw memberError

      setShowCreate(false)
      setCreateForm({ name: '', description: '' })
      showToastMsg('Group berhasil dibuat!')
      loadGroups()
    } catch (err) {
      showToastMsg('Gagal membuat group: ' + err.message, 'error')
    } finally {
      setCreating(false)
    }
  }

  const joinGroup = async (e) => {
    e.preventDefault()
    setJoinError('')
    if (!inviteCode.trim()) return setJoinError('Masukkan kode undangan')

    setJoining(true)
    try {
      // Find group by invite code
      // Case-insensitive search for invite code
      const codeInput = inviteCode.trim().toLowerCase()
      const { data: group, error: findError } = await supabase
        .from('groups')
        .select('id, name')
        .ilike('invite_code', codeInput)
        .single()

      if (findError || !group) {
        setJoinError('Kode undangan tidak ditemukan')
        return
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', profile.id)
        .single()

      if (existing) {
        setJoinError('Kamu sudah menjadi anggota group ini')
        return
      }

      // Join group
      const { error: joinErr } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: profile.id,
          role: 'member',
        })

      if (joinErr) throw joinErr

      setShowJoin(false)
      setInviteCode('')
      showToastMsg(`Berhasil bergabung ke ${group.name}!`)
      loadGroups()
    } catch (err) {
      setJoinError('Gagal bergabung: ' + err.message)
    } finally {
      setJoining(false)
    }
  }

  const leaveGroup = async (groupId, groupName) => {
    if (!confirm(`Keluar dari group "${groupName}"?`)) return
    try {
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', profile.id)

      showToastMsg('Berhasil keluar dari group')
      loadGroups()
    } catch (err) {
      showToastMsg('Gagal keluar: ' + err.message, 'error')
    }
  }

  const deleteGroup = async (groupId, groupName) => {
    if (!confirm(`Hapus group "${groupName}"? Semua data akan hilang.`)) return
    try {
      await supabase.from('groups').delete().eq('id', groupId)
      showToastMsg('Group dihapus')
      loadGroups()
    } catch (err) {
      showToastMsg('Gagal menghapus: ' + err.message, 'error')
    }
  }

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code)
    showToastMsg('Kode undangan disalin!')
  }

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto fade-in">
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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Groups</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoin(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-dark-800 hover:bg-dark-700 text-white text-sm rounded-xl transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Join</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 gradient-bg text-white text-sm rounded-xl hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Group</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder="Cari group..." className="mb-4" />

      {/* Groups list */}
      {loading ? (
        <LoadingSpinner size="lg" text="Memuat groups..." className="py-12" />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Tidak ditemukan' : 'Belum ada group'}
          description={search ? 'Coba kata kunci lain' : 'Buat group baru atau join dengan kode undangan'}
          action={
            !search && (
              <button onClick={() => setShowCreate(true)} className="px-4 py-2 gradient-bg rounded-xl text-sm text-white font-medium">
                Buat Group
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredGroups.map(group => (
            <div key={group.id} className="glass-card glass-card-hover rounded-xl p-4 transition-all duration-200">
              <div className="flex items-start gap-3 mb-3">
                <Avatar src={group.avatar_url} name={group.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{group.name}</h3>
                  <p className="text-xs text-dark-400 truncate">{group.description || 'Group belajar'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      group.role === 'owner' ? 'bg-yellow-500/20 text-yellow-400' :
                      group.role === 'admin' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-dark-700 text-dark-400'
                    }`}>
                      {group.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-dark-700">
                <Link
                  to={`/groups/${group.id}/chat`}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chat
                </Link>
                <Link
                  to={`/groups/${group.id}/notes`}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <StickyNote className="w-3.5 h-3.5" /> Catatan
                </Link>
                <button
                  onClick={() => copyInviteCode(group.invite_code)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-dark-300 hover:text-primary-400 hover:bg-dark-700 rounded-lg transition-colors"
                  title={`Kode: ${group.invite_code}`}
                >
                  <Copy className="w-3.5 h-3.5" /> Kode
                </button>
                <div className="flex-1" />
                {group.role === 'owner' ? (
                  <button
                    onClick={() => deleteGroup(group.id, group.name)}
                    className="p-1.5 text-dark-500 hover:text-red-400 rounded-lg transition-colors"
                    title="Hapus group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => leaveGroup(group.id, group.name)}
                    className="p-1.5 text-dark-500 hover:text-red-400 rounded-lg transition-colors"
                    title="Keluar group"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Buat Group Baru">
        <form onSubmit={createGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Nama Group</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="contoh: Kelas 12 IPA 1"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Deskripsi (opsional)</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Deskripsi group..."
              rows={2}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !createForm.name.trim()}
            className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {creating ? 'Membuat...' : 'Buat Group'}
          </button>
        </form>
      </Modal>

      {/* Join Modal */}
      <Modal isOpen={showJoin} onClose={() => { setShowJoin(false); setJoinError('') }} title="Gabung Group">
        <form onSubmit={joinGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Kode Undangan</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setJoinError('') }}
                placeholder="Masukkan kode undangan"
                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
            {joinError && (
              <p className="text-sm text-red-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {joinError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={joining || !inviteCode.trim()}
            className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {joining ? 'Bergabung...' : 'Gabung'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
