import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import { UserPlus, UserCheck, Clock, ArrowLeft, MessageCircle } from 'lucide-react'

export default function UserProfilePage() {
  const { username } = useParams()
  const { profile: currentUser } = useAuth()
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [friendStatus, setFriendStatus] = useState(null) // 'none', 'pending', 'accepted'
  const [requestId, setRequestId] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (username) loadProfile()
  }, [username, currentUser])

  const loadProfile = async () => {
    setLoading(true)
    setError('')
    try {
      // Fetch user by username
      const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio')
        .ilike('username', username)
        
      if (userError) throw userError
      if (!users || users.length === 0) {
        setError('Pengguna tidak ditemukan')
        return
      }
      
      const targetUser = users[0]
      setUserProfile(targetUser)

      // If viewing own profile
      if (currentUser && targetUser.id === currentUser.id) {
        setLoading(false)
        return
      }

      // Check friendship status
      if (currentUser) {
        const { data: requestData } = await supabase
          .from('friend_requests')
          .select('id, status')
          .or(
            `and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${currentUser.id})`
          )
          
        if (requestData && requestData.length > 0) {
          setFriendStatus(requestData[0].status)
          setRequestId(requestData[0].id)
        } else {
          setFriendStatus('none')
        }
      }
    } catch (err) {
      console.error(err)
      setError('Gagal memuat profil')
    } finally {
      setLoading(false)
    }
  }

  const handleAddFriend = async () => {
    if (!currentUser || !userProfile) return
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({ sender_id: currentUser.id, receiver_id: userProfile.id })
        
      if (error) throw error
      setFriendStatus('pending')
    } catch (err) {
      alert('Gagal mengirim permintaan berteman')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Memuat profil..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center mt-20">
        <h2 className="text-xl font-bold text-white mb-2">{error}</h2>
        <Link to="/friends" className="text-primary-400 hover:text-primary-300">Kembali ke Pencarian Teman</Link>
      </div>
    )
  }

  if (!userProfile) return null

  const isSelf = currentUser?.id === userProfile.id

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto fade-in">
      <Link to={-1} className="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-5 h-5" />
        Kembali
      </Link>

      <div className="glass-card rounded-3xl overflow-hidden relative">
        {/* Banner */}
        <div className="h-32 md:h-48 relative bg-dark-900">
          {userProfile.banner_url ? (
            <img src={userProfile.banner_url} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-900 via-indigo-900 to-purple-900"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-transparent to-transparent"></div>
        </div>
        
        <div className="px-6 pb-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 -mt-12 md:-mt-16 mb-4">
            <Avatar 
              src={userProfile.avatar_url} 
              name={userProfile.full_name} 
              size="2xl" 
              className="w-24 h-24 md:w-32 md:h-32 ring-4 ring-dark-950 shadow-xl"
            />
            
            <div className="flex gap-2">
              {isSelf ? (
                <Link to="/profile" className="px-6 py-2 rounded-xl border border-dark-600 text-white font-medium hover:bg-dark-800 transition-colors">
                  Edit Profil
                </Link>
              ) : (
                <>
                  {friendStatus === 'accepted' ? (
                    <div className="flex gap-2">
                      <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800 text-green-400 font-medium">
                        <UserCheck className="w-5 h-5" /> Teman
                      </span>
                      <Link to="/groups" className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-bg text-white font-medium hover:opacity-90">
                        <MessageCircle className="w-5 h-5" /> Pesan
                      </Link>
                    </div>
                  ) : friendStatus === 'pending' ? (
                    <span className="flex items-center gap-2 px-6 py-2 rounded-xl bg-dark-800 text-yellow-400 font-medium">
                      <Clock className="w-5 h-5" /> Menunggu
                    </span>
                  ) : (
                    <button 
                      onClick={handleAddFriend}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-6 py-2 rounded-xl gradient-bg text-white font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      <UserPlus className="w-5 h-5" /> 
                      {actionLoading ? 'Memproses...' : 'Tambah Teman'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-2">
            <h1 className="text-2xl font-bold text-white">{userProfile.full_name}</h1>
            <p className="text-primary-400 font-medium mt-0.5">@{userProfile.username}</p>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-dark-900/50 border border-dark-800">
            <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-2">Bio</h3>
            {userProfile.bio ? (
              <p className="text-white whitespace-pre-wrap">{userProfile.bio}</p>
            ) : (
              <p className="text-dark-500 italic">Pengguna ini belum menuliskan bio.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
