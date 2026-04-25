import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import {
  UserSearch, UserPlus, UserCheck, UserX, Phone, Search,
  AlertCircle, CheckCircle, X, Users, Clock, MessageCircle
} from 'lucide-react'
import { isValidIndonesianPhone, normalizePhone, maskPhone, formatDate } from '../lib/utils'

export default function FriendsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('friends') // friends | search | requests
  const [friends, setFriends] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (profile) {
      loadFriends()
      loadRequests()
    }
  }, [profile])

  // Realtime subscription for friend requests
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel('friend-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${profile.id}`,
      }, () => {
        loadRequests()
        loadFriends()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const loadFriends = async () => {
    try {
      // Get accepted friend requests where user is either sender or receiver
      const { data } = await supabase
        .from('friend_requests')
        .select('*, sender:sender_id(id, full_name, username, avatar_url), receiver:receiver_id(id, full_name, username, avatar_url)')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      const friendsList = (data || []).map(req => {
        return req.sender_id === profile.id ? { ...req.receiver, requestId: req.id } : { ...req.sender, requestId: req.id }
      })
      setFriends(friendsList)
    } catch (err) {
      console.error('Load friends error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadRequests = async () => {
    try {
      const { data: incoming } = await supabase
        .from('friend_requests')
        .select('*, sender:sender_id(id, full_name, username, avatar_url)')
        .eq('receiver_id', profile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      setIncomingRequests(incoming || [])

      const { data: outgoing } = await supabase
        .from('friend_requests')
        .select('*, receiver:receiver_id(id, full_name, username, avatar_url)')
        .eq('sender_id', profile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      setOutgoingRequests(outgoing || [])
    } catch (err) {
      console.error('Load requests error:', err)
    }
  }

  const handleSearch = async () => {
    setSearchError('')
    setSearchResult(null)

    if (!searchQuery.trim()) return setSearchError('Masukkan Username atau Nomor HP')

    setSearching(true)
    try {
      let found = null
      
      // Try username first
      const { data: userByUsername, error: errUser } = await supabase.rpc('search_by_username', { search_username: searchQuery.trim().toLowerCase() })
      if (!errUser && userByUsername && userByUsername.length > 0) {
        found = userByUsername[0]
      }

      // If not found and looks like a phone number, try phone
      if (!found && /^[0-9+\s-]+$/.test(searchQuery)) {
        const normalized = normalizePhone(searchQuery)
        if (isValidIndonesianPhone(normalized)) {
          const { data: userByPhone, error: errPhone } = await supabase.rpc('search_by_phone', { search_phone: normalized })
          if (!errPhone && userByPhone && userByPhone.length > 0) {
            found = userByPhone[0]
          }
        }
      }

      if (!found) {
        setSearchError('Pengguna tidak ditemukan')
        return
      }

      if (found.id === profile.id) {
        setSearchError('Tidak dapat mencari akun Anda sendiri')
        return
      }

      // Check if already friends or request pending
      const { data: existing } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(
          `and(sender_id.eq.${profile.id},receiver_id.eq.${found.id}),and(sender_id.eq.${found.id},receiver_id.eq.${profile.id})`
        )

      const existingReq = existing?.[0]
      setSearchResult({
        ...found,
        existingStatus: existingReq?.status || null,
        existingId: existingReq?.id || null,
      })
    } catch (err) {
      setSearchError('Gagal melakukan pencarian: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  const sendRequest = async (userId) => {
    setActionLoading(userId)
    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({ sender_id: profile.id, receiver_id: userId })

      if (error) {
        if (error.code === '23505') {
          showToast('Request sudah pernah dikirim')
          return
        }
        throw error
      }

      showToast('Permintaan teman terkirim!')
      setSearchResult(prev => prev ? { ...prev, existingStatus: 'pending' } : null)
      loadRequests()
    } catch (err) {
      showToast('Gagal mengirim: ' + err.message)
    } finally {
      setActionLoading('')
    }
  }

  const acceptRequest = async (requestId) => {
    setActionLoading(requestId)
    try {
      await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      showToast('Permintaan diterima!')
      loadRequests()
      loadFriends()
    } catch (err) {
      showToast('Gagal menerima: ' + err.message)
    } finally {
      setActionLoading('')
    }
  }

  const rejectRequest = async (requestId) => {
    setActionLoading(requestId)
    try {
      await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)

      showToast('Permintaan ditolak')
      loadRequests()
    } catch (err) {
      showToast('Gagal menolak: ' + err.message)
    } finally {
      setActionLoading('')
    }
  }

  const removeFriend = async (requestId) => {
    if (!confirm('Hapus teman ini?')) return
    setActionLoading(requestId)
    try {
      await supabase.from('friend_requests').delete().eq('id', requestId)
      showToast('Teman dihapus')
      loadFriends()
    } catch (err) {
      showToast('Gagal menghapus: ' + err.message)
    } finally {
      setActionLoading('')
    }
  }

  const startDM = async (friendId) => {
    try {
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('direct_conversations')
        .select('id')
        .or(
          `and(user1_id.eq.${profile.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${profile.id})`
        )
        .single()

      if (existing) {
        navigate(`/dm/${existing.id}`)
        return
      }

      const [u1, u2] = profile.id < friendId ? [profile.id, friendId] : [friendId, profile.id]
      const { data: newConv, error } = await supabase
        .from('direct_conversations')
        .insert({ user1_id: u1, user2_id: u2 })
        .select()
        .single()

      if (error) throw error
      navigate(`/dm/${newConv.id}`)
    } catch (err) {
      console.error('Start DM error:', err)
      showToast('Gagal memulai chat')
    }
  }

  const tabs = [
    { id: 'friends', label: 'Teman', icon: Users, count: friends.length },
    { id: 'search', label: 'Cari', icon: UserSearch },
    { id: 'requests', label: 'Request', icon: Clock, count: incomingRequests.length },
  ]

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Teman</h1>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 p-3 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white shadow-lg slide-up">
          <CheckCircle className="w-4 h-4 text-green-400" />
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-dark-800 rounded-xl mb-6">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                tab === id ? 'bg-white/20' : 'bg-primary-500/20 text-primary-400'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Friends List */}
      {tab === 'friends' && (
        <div>
          {loading ? (
            <LoadingSpinner size="lg" text="Memuat teman..." className="py-12" />
          ) : friends.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Belum ada teman"
              description="Cari teman menggunakan Username atau Nomor HP"
              action={
                <button onClick={() => setTab('search')} className="px-4 py-2 gradient-bg rounded-xl text-sm text-white font-medium">
                  Cari Teman
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {friends.map(friend => (
                <div key={friend.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                  <Link to={`/user/${friend.username}`} className="shrink-0 hover:opacity-80 transition-opacity">
                    <Avatar src={friend.avatar_url} name={friend.full_name} size="md" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/user/${friend.username}`} className="hover:underline">
                      <p className="text-sm font-semibold text-white truncate">{friend.full_name}</p>
                    </Link>
                    <p className="text-xs text-dark-400">@{friend.username}</p>
                  </div>
                  <button
                    onClick={() => startDM(friend.id)}
                    className="p-2 text-dark-400 hover:text-primary-400 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Chat pribadi"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFriend(friend.requestId)}
                    disabled={actionLoading === friend.requestId}
                    className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
                    title="Hapus teman"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {tab === 'search' && (
        <div>
          <div className="glass-card rounded-xl p-4 mb-4">
            <label className="block text-sm font-medium text-dark-300 mb-2">Cari via Username / Nomor HP</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Masukkan Username atau Nomor HP"
                  className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-3 gradient-bg rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {searching ? <LoadingSpinner size="sm" /> : <Search className="w-5 h-5" />}
              </button>
            </div>
            {searchError && (
              <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {searchResult && (
            <div className="glass-card rounded-xl p-4 flex items-center gap-4 slide-up">
              <Link to={`/user/${searchResult.username}`} className="shrink-0 hover:opacity-80 transition-opacity">
                <Avatar src={searchResult.avatar_url} name={searchResult.full_name} size="lg" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/user/${searchResult.username}`} className="hover:underline">
                  <p className="font-semibold text-white">{searchResult.full_name}</p>
                </Link>
                <p className="text-sm text-dark-400">@{searchResult.username}</p>
              </div>
              {searchResult.existingStatus === 'accepted' ? (
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <UserCheck className="w-4 h-4" /> Teman
                </span>
              ) : searchResult.existingStatus === 'pending' ? (
                <span className="flex items-center gap-1 text-yellow-400 text-sm">
                  <Clock className="w-4 h-4" /> Pending
                </span>
              ) : (
                <button
                  onClick={() => sendRequest(searchResult.id)}
                  disabled={actionLoading === searchResult.id}
                  className="flex items-center gap-1.5 px-4 py-2 gradient-bg rounded-xl text-sm text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  Tambah
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Requests */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {/* Incoming */}
          <div>
            <h3 className="text-sm font-semibold text-dark-300 mb-2">Masuk ({incomingRequests.length})</h3>
            {incomingRequests.length === 0 ? (
              <p className="text-sm text-dark-500 py-4 text-center">Tidak ada request masuk</p>
            ) : (
              <div className="space-y-2">
                {incomingRequests.map(req => (
                  <div key={req.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                    <Avatar src={req.sender?.avatar_url} name={req.sender?.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{req.sender?.full_name}</p>
                      <p className="text-xs text-dark-400">@{req.sender?.username}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => acceptRequest(req.id)}
                        disabled={actionLoading === req.id}
                        className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
                        title="Terima"
                      >
                        <UserCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rejectRequest(req.id)}
                        disabled={actionLoading === req.id}
                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                        title="Tolak"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div>
            <h3 className="text-sm font-semibold text-dark-300 mb-2">Terkirim ({outgoingRequests.length})</h3>
            {outgoingRequests.length === 0 ? (
              <p className="text-sm text-dark-500 py-4 text-center">Tidak ada request terkirim</p>
            ) : (
              <div className="space-y-2">
                {outgoingRequests.map(req => (
                  <div key={req.id} className="glass-card rounded-xl p-4 flex items-center gap-3">
                    <Avatar src={req.receiver?.avatar_url} name={req.receiver?.full_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{req.receiver?.full_name}</p>
                      <p className="text-xs text-dark-400">@{req.receiver?.username}</p>
                    </div>
                    <span className="text-xs text-yellow-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Menunggu
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
