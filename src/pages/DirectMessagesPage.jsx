import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import SearchInput from '../components/SearchInput'
import { MessageCircle, Plus, Search, UserPlus } from 'lucide-react'
import { formatDate } from '../lib/utils'

export default function DirectMessagesPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [friends, setFriends] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [creating, setCreating] = useState('')

  useEffect(() => {
    if (profile) loadConversations()
  }, [profile])

  const loadConversations = async () => {
    try {
      const { data } = await supabase
        .from('direct_conversations')
        .select(`
          *,
          user1:user1_id(id, full_name, username, avatar_url),
          user2:user2_id(id, full_name, username, avatar_url)
        `)
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
        .order('updated_at', { ascending: false })

      // Enrich with last message
      const enriched = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUser = conv.user1_id === profile.id ? conv.user2 : conv.user1
          
          const { data: lastMsg } = await supabase
            .from('direct_messages')
            .select('content, created_at, sender_id, message_type')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...conv,
            otherUser,
            lastMessage: lastMsg || null,
          }
        })
      )

      setConversations(enriched)
    } catch (err) {
      console.error('Load conversations error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadFriends = async () => {
    setLoadingFriends(true)
    try {
      const { data } = await supabase
        .from('friend_requests')
        .select('*, sender:sender_id(id, full_name, username, avatar_url), receiver:receiver_id(id, full_name, username, avatar_url)')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      const friendsList = (data || []).map(req =>
        req.sender_id === profile.id ? req.receiver : req.sender
      )
      setFriends(friendsList)
    } catch (err) {
      console.error('Load friends error:', err)
    } finally {
      setLoadingFriends(false)
    }
  }

  const startConversation = async (friendId) => {
    setCreating(friendId)
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

      // Create new conversation (always put smaller uuid as user1 for consistency)
      const [u1, u2] = profile.id < friendId ? [profile.id, friendId] : [friendId, profile.id]
      const { data: newConv, error } = await supabase
        .from('direct_conversations')
        .insert({ user1_id: u1, user2_id: u2 })
        .select()
        .single()

      if (error) throw error
      navigate(`/dm/${newConv.id}`)
    } catch (err) {
      console.error('Start conversation error:', err)
      alert('Gagal memulai percakapan: ' + err.message)
    } finally {
      setCreating('')
    }
  }

  const openNewChat = () => {
    setShowNewChat(true)
    loadFriends()
  }

  const filteredConversations = conversations.filter(conv =>
    conv.otherUser?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    conv.otherUser?.username?.toLowerCase().includes(search.toLowerCase())
  )

  const getLastMessagePreview = (conv) => {
    if (!conv.lastMessage) return 'Belum ada pesan'
    if (conv.lastMessage.message_type === 'image') return '📷 Foto'
    if (conv.lastMessage.message_type === 'video') return '🎬 Video'
    if (conv.lastMessage.message_type === 'audio') return '🎵 Audio'
    if (conv.lastMessage.message_type === 'file') return '📎 File'
    return '[Pesan terenkripsi]'
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Chat Pribadi</h1>
        <button
          onClick={openNewChat}
          className="flex items-center gap-1.5 px-3 py-2 gradient-bg text-white text-sm rounded-xl hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Chat Baru</span>
        </button>
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder="Cari percakapan..." className="mb-4" />

      {/* Conversations list */}
      {loading ? (
        <LoadingSpinner size="lg" text="Memuat chat..." className="py-12" />
      ) : filteredConversations.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title={search ? 'Tidak ditemukan' : 'Belum ada chat pribadi'}
          description="Mulai percakapan baru dengan temanmu"
          action={
            !search && (
              <button onClick={openNewChat} className="px-4 py-2 gradient-bg rounded-xl text-sm text-white font-medium">
                Mulai Chat
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredConversations.map(conv => (
            <Link
              key={conv.id}
              to={`/dm/${conv.id}`}
              className="glass-card glass-card-hover rounded-xl p-4 flex items-center gap-3 transition-all duration-200 block"
            >
              <Avatar src={conv.otherUser?.avatar_url} name={conv.otherUser?.full_name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">{conv.otherUser?.full_name}</h3>
                  {conv.lastMessage?.created_at && (
                    <span className="text-[10px] text-dark-500 shrink-0">
                      {formatDate(conv.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-dark-400 truncate mt-0.5">
                  {conv.lastMessage?.sender_id === profile.id ? 'Kamu: ' : ''}
                  {getLastMessagePreview(conv)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Chat Modal */}
      <Modal isOpen={showNewChat} onClose={() => setShowNewChat(false)} title="Chat Baru">
        {loadingFriends ? (
          <LoadingSpinner size="md" text="Memuat teman..." className="py-8" />
        ) : friends.length === 0 ? (
          <div className="text-center py-8">
            <UserPlus className="w-10 h-10 text-dark-500 mx-auto mb-3" />
            <p className="text-dark-400 text-sm">Belum ada teman.</p>
            <Link to="/friends" className="text-primary-400 text-sm hover:underline mt-1 inline-block">
              Cari teman dulu
            </Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => startConversation(friend.id)}
                disabled={creating === friend.id}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-dark-700 transition-colors text-left disabled:opacity-50"
              >
                <Avatar src={friend.avatar_url} name={friend.full_name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{friend.full_name}</p>
                  <p className="text-xs text-dark-400">@{friend.username}</p>
                </div>
                <MessageCircle className="w-5 h-5 text-primary-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
