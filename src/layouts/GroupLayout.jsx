import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import Modal from '../components/Modal'
import { ArrowLeft, Plus, Copy, MoreVertical, MessageSquare, StickyNote, Users, Settings, Camera, Trash2, Image as ImageIcon, UserPlus, Check, AlertCircle } from 'lucide-react'
import { validateFile } from '../lib/utils'

export default function GroupLayout() {
  const { id: groupId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [menuOpen, setMenuOpen] = useState(false)
  
  // Add friend modal state
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendsList, setFriendsList] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [addingFriend, setAddingFriend] = useState('')
  const [addFriendToast, setAddFriendToast] = useState('')
  const [addFriendError, setAddFriendError] = useState('')
  
  const avatarInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (profile && groupId) {
      loadGroupData()
      
      // Setup presence
      const channel = supabase.channel(`presence:group_${groupId}`)
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const online = new Set()
          for (const id in state) {
            if (state[id] && state[id][0]) {
              online.add(state[id][0].user_id)
            }
          }
          setOnlineUsers(online)
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user_id: profile.id, online_at: new Date().toISOString() })
          }
        })

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [profile, groupId])

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef])

  const loadGroupData = async () => {
    try {
      // Check membership
      const { data: membership } = await supabase
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', profile.id)
        .single()

      if (!membership) {
        navigate('/groups')
        return
      }

      // Load group info
      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      setGroup({ ...groupData, myRole: membership.role })

      // Load members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*, profiles:user_id(id, full_name, username, avatar_url)')
        .eq('group_id', groupId)

      setMembers(membersData || [])
    } catch (err) {
      console.error('Group load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyInviteCode = () => {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveGroup = async () => {
    if (!confirm('Keluar dari grup ini?')) return
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', profile.id)

      if (error) throw error
      navigate('/dashboard')
    } catch (err) {
      alert('Gagal keluar grup: ' + err.message)
    }
  }

  const deleteGroup = async () => {
    if (!confirm('Hapus grup ini secara permanen? Semua data chat akan hilang.')) return
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)

      if (error) throw error
      navigate('/dashboard')
    } catch (err) {
      alert('Gagal menghapus grup: ' + err.message)
    }
  }

  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateFile(file, type === 'banner' ? 'chat' : 'avatar')
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    if (type === 'banner') setUploadingBanner(true)
    else setUploadingAvatar(true)

    try {
      const fileExt = file.name.split('.').pop()
      // Store under user's folder to pass RLS: <userId>/groups/<groupId>/<filename>
      const filePath = `${profile.id}/groups/${groupId}/${type}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const updateData = type === 'banner' ? { banner_url: publicUrl } : { avatar_url: publicUrl }
      
      const { error: dbError } = await supabase
        .from('groups')
        .update(updateData)
        .eq('id', groupId)

      if (dbError) throw dbError

      setGroup(prev => ({ ...prev, ...updateData }))
    } catch (err) {
      alert(`Gagal upload ${type}: ` + err.message)
    } finally {
      if (type === 'banner') setUploadingBanner(false)
      else setUploadingAvatar(false)
    }
  }

  // Load friends for add-to-group
  const loadFriendsForGroup = async () => {
    setLoadingFriends(true)
    setAddFriendError('')
    try {
      const { data } = await supabase
        .from('friend_requests')
        .select('*, sender:sender_id(id, full_name, username, avatar_url), receiver:receiver_id(id, full_name, username, avatar_url)')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      const allFriends = (data || []).map(req =>
        req.sender_id === profile.id ? req.receiver : req.sender
      )

      // Filter out users who are already members
      const memberIds = new Set(members.map(m => m.profiles?.id || m.user_id))
      const availableFriends = allFriends.filter(f => !memberIds.has(f.id))
      
      setFriendsList(availableFriends)
    } catch (err) {
      console.error('Load friends error:', err)
    } finally {
      setLoadingFriends(false)
    }
  }

  const addFriendToGroup = async (friendId) => {
    setAddingFriend(friendId)
    setAddFriendError('')
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: friendId,
          role: 'member',
        })

      if (error) {
        if (error.code === '23505') {
          setAddFriendError('User sudah menjadi anggota')
          return
        }
        throw error
      }

      // Remove from available list
      setFriendsList(prev => prev.filter(f => f.id !== friendId))
      setAddFriendToast('Berhasil ditambahkan!')
      setTimeout(() => setAddFriendToast(''), 2000)

      // Reload members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*, profiles:user_id(id, full_name, username, avatar_url)')
        .eq('group_id', groupId)

      setMembers(membersData || [])
    } catch (err) {
      setAddFriendError('Gagal menambahkan: ' + err.message)
    } finally {
      setAddingFriend('')
    }
  }

  const openAddFriendModal = () => {
    setShowAddFriend(true)
    loadFriendsForGroup()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Memuat group..." />
      </div>
    )
  }

  if (!group) return null

  const tabs = [
    { id: 'chat', label: 'Chat', path: `/groups/${groupId}/chat` },
    { id: 'notes', label: 'Catatan', path: `/groups/${groupId}/notes` },
    { id: 'members', label: 'Anggota', path: `/groups/${groupId}/members` },
    { id: 'settings', label: 'Pengaturan', path: `/groups/${groupId}/settings` },
  ]

  const isChatRoute = location.pathname.endsWith('/chat')

  if (isChatRoute) {
    return (
      <div className="flex flex-col h-full bg-dark-950 fade-in overflow-hidden">
        {/* Slim Header for Chat */}
        <div className="flex items-center gap-3 px-4 py-3 bg-dark-900 border-b border-dark-800 shrink-0 relative z-10 shadow-sm">
          <button onClick={() => navigate('/groups')} className="p-1 md:hidden text-dark-400 hover:text-white transition-colors rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <Link to={`/groups/${groupId}/members`} className="flex items-center gap-3 flex-1 min-w-0 hover:bg-dark-800/50 p-1.5 -ml-1.5 rounded-xl transition-colors">
            <Avatar src={group.avatar_url} name={group.name} size="md" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">{group.name}</h2>
              <p className="text-xs text-primary-400 truncate font-medium">
                {members.length} anggota, {onlineUsers.size} online
              </p>
            </div>
          </Link>
          
          <div className="flex items-center gap-1">
            <button
              onClick={openAddFriendModal}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              title="Tambah Teman"
            >
              <UserPlus className="w-5 h-5" />
            </button>
            <Link
              to={`/groups/${groupId}/notes`}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
              title="Catatan"
            >
              <StickyNote className="w-5 h-5" />
            </Link>
            
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                title="Opsi Lainnya"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-lg py-1 z-50 slide-up">
                  <Link
                    to={`/groups/${groupId}/members`}
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-dark-200 hover:text-white hover:bg-dark-700 transition-colors"
                  >
                    Info Group
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      copyInviteCode()
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-dark-200 hover:text-white hover:bg-dark-700 transition-colors"
                  >
                    Salin Kode Undangan
                  </button>
                  <div className="my-1 border-t border-dark-700"></div>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      leaveGroup()
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Keluar Grup
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area (GroupChatPage) */}
        <div className="flex-1 overflow-hidden relative bg-dark-950">
          <Outlet context={{ group, members, setMembers, profile }} />
        </div>

        {/* Add Friend Modal */}
        <AddFriendModal
          isOpen={showAddFriend}
          onClose={() => setShowAddFriend(false)}
          friendsList={friendsList}
          loadingFriends={loadingFriends}
          addingFriend={addingFriend}
          addFriendToast={addFriendToast}
          addFriendError={addFriendError}
          addFriendToGroup={addFriendToGroup}
          copyInviteCode={copyInviteCode}
          copied={copied}
          inviteCode={group.invite_code}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-dark-950 fade-in overflow-hidden">
      {/* Header Area with Banner */}
      <div className="relative flex-shrink-0">
        {/* Banner Background */}
        <div 
          className="absolute inset-0 z-0 bg-dark-900 overflow-hidden"
        >
          {group.banner_url ? (
            <img src={group.banner_url} alt="Banner" className="w-full h-full object-cover opacity-50" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-900 via-indigo-900 to-purple-900 opacity-60"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/80 to-transparent"></div>
        </div>

        <div className="relative z-10 p-4 md:p-6 pb-0">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/groups')} className="p-2 -ml-2 text-dark-200 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              {(group.myRole === 'admin' || group.myRole === 'owner') && (
                <>
                  <input type="file" ref={bannerInputRef} onChange={(e) => handleImageUpload(e, 'banner')} accept="image/*" className="hidden" />
                  <button 
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={uploadingBanner}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-800/80 hover:bg-dark-700/80 backdrop-blur-sm text-white font-medium transition-colors border border-dark-600/50"
                  >
                    {uploadingBanner ? <LoadingSpinner size="sm" /> : <ImageIcon className="w-4 h-4" />}
                    <span className="hidden sm:inline text-sm">Ubah Banner</span>
                  </button>
                </>
              )}
              <button
                onClick={openAddFriendModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition-opacity"
              >
                <UserPlus className="w-4 h-4" />
                <span className="text-sm">Tambah Anggota</span>
              </button>
            </div>
          </div>

        {/* Group Info */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex gap-4">
            <div className="relative group/avatar shrink-0">
              <Avatar 
                src={group.avatar_url} 
                name={group.name} 
                size="2xl" 
                className="w-20 h-20 md:w-24 md:h-24 rounded-full ring-4 ring-dark-950 shadow-xl"
              />
              {(group.myRole === 'admin' || group.myRole === 'owner') && (
                <>
                  <input type="file" ref={avatarInputRef} onChange={(e) => handleImageUpload(e, 'avatar')} accept="image/*" className="hidden" />
                  <button 
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {uploadingAvatar ? <LoadingSpinner size="sm" /> : <Camera className="w-6 h-6 text-white" />}
                  </button>
                </>
              )}
            </div>
            <div className="pt-1">
              <h1 className="text-xl md:text-3xl font-bold text-white mb-1 drop-shadow-sm">{group.name}</h1>
              <p className="text-sm text-dark-300 mb-2">{members.length} anggota</p>
              <p className="text-sm text-dark-200 line-clamp-2 max-w-md">
                {group.description || 'Tidak ada deskripsi.'}
              </p>
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 rounded-lg transition-colors mt-1 ${menuOpen ? 'bg-dark-800 text-white' : 'text-dark-400 hover:text-white'}`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
                <button
                  onClick={() => { setMenuOpen(false); navigate(`/groups/${groupId}`) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-dark-200 hover:bg-dark-700 hover:text-white transition-colors"
                >
                  <MessageSquare className="w-4 h-4" /> Info Grup
                </button>
                
                <div className="h-[1px] bg-dark-700 my-1 mx-2" />
                
                <button
                  onClick={() => { setMenuOpen(false); leaveGroup() }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-yellow-500/80 hover:bg-yellow-500/10 hover:text-yellow-500 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Keluar Grup
                </button>

                {group.myRole === 'owner' && (
                  <button
                    onClick={() => { setMenuOpen(false); deleteGroup() }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Hapus Grup
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Invite Code Box */}
        <div className="bg-dark-900/50 border border-dark-800 rounded-xl p-4 mb-6 flex items-center justify-between max-w-md">
          <div>
            <p className="text-xs text-dark-400 mb-1">Kode Undangan</p>
            <p className="text-base font-bold text-primary-400 tracking-wider">{group.invite_code}</p>
          </div>
          <button 
            onClick={copyInviteCode}
            className="p-2 text-dark-400 hover:text-white bg-dark-800 rounded-lg transition-colors"
            title="Salin kode"
          >
            {copied ? <span className="text-xs text-green-400 font-medium">Tersalin!</span> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-dark-800/60 pt-2">
          {tabs.map(tab => {
            const isActive = location.pathname.includes(tab.path)
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 relative -bottom-[1px] ${
                  isActive 
                    ? 'text-primary-400 border-primary-500' 
                    : 'text-dark-400 border-transparent hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-dark-950">
        <Outlet context={{ group, setGroup, members, setMembers, profile }} />
      </div>

      {/* Add Friend Modal */}
      <AddFriendModal
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        friendsList={friendsList}
        loadingFriends={loadingFriends}
        addingFriend={addingFriend}
        addFriendToast={addFriendToast}
        addFriendError={addFriendError}
        addFriendToGroup={addFriendToGroup}
        copyInviteCode={copyInviteCode}
        copied={copied}
        inviteCode={group.invite_code}
      />
    </div>
  )
}

// Separate component for the Add Friend modal
function AddFriendModal({
  isOpen, onClose, friendsList, loadingFriends, addingFriend,
  addFriendToast, addFriendError, addFriendToGroup,
  copyInviteCode, copied, inviteCode
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Anggota">
      {/* Invite code section */}
      <div className="bg-dark-800 rounded-xl p-4 mb-4">
        <p className="text-xs text-dark-400 mb-2">Bagikan kode undangan</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 bg-dark-900 border border-dark-700 rounded-lg text-primary-400 font-bold tracking-wider text-sm select-all">
            {inviteCode}
          </div>
          <button
            onClick={copyInviteCode}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm rounded-lg font-medium transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-[1px] bg-dark-700" />
        <span className="text-xs text-dark-500">atau tambah dari daftar teman</span>
        <div className="flex-1 h-[1px] bg-dark-700" />
      </div>

      {/* Toast / Error */}
      {addFriendToast && (
        <div className="flex items-center gap-2 p-3 mb-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <Check className="w-4 h-4" /> {addFriendToast}
        </div>
      )}
      {addFriendError && (
        <div className="flex items-center gap-2 p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {addFriendError}
        </div>
      )}

      {/* Friends list */}
      {loadingFriends ? (
        <LoadingSpinner size="md" text="Memuat teman..." className="py-8" />
      ) : friendsList.length === 0 ? (
        <div className="text-center py-6">
          <Users className="w-10 h-10 text-dark-500 mx-auto mb-2" />
          <p className="text-dark-400 text-sm">Semua temanmu sudah ada di group ini</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {friendsList.map(friend => (
            <div
              key={friend.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-dark-800 transition-colors"
            >
              <Avatar src={friend.avatar_url} name={friend.full_name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{friend.full_name}</p>
                <p className="text-xs text-dark-400">@{friend.username}</p>
              </div>
              <button
                onClick={() => addFriendToGroup(friend.id)}
                disabled={addingFriend === friend.id}
                className="flex items-center gap-1.5 px-3 py-1.5 gradient-bg rounded-lg text-sm text-white font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
              >
                {addingFriend === friend.id ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Tambah
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
