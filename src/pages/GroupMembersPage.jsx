import { useOutletContext, Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { supabase } from '../lib/supabase'

export default function GroupMembersPage() {
  const { members, setMembers, group, profile } = useOutletContext()

  const handleKick = async (memberUserId) => {
    if (!confirm('Apakah anda yakin ingin mengeluarkan anggota ini?')) return

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', group.id)
        .eq('user_id', memberUserId)

      if (error) throw error

      setMembers(members.filter(m => m.user_id !== memberUserId))
    } catch (err) {
      alert('Gagal mengeluarkan anggota: ' + err.message)
    }
  }

  const canKick = (targetRole, targetUserId) => {
    if (targetUserId === profile?.id) return false
    if (group?.myRole !== 'owner' && group?.myRole !== 'admin') return false
    if (group?.myRole === 'owner') return true
    if (group?.myRole === 'admin' && targetRole === 'member') return true
    return false
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 fade-in h-full">
      <div className="max-w-3xl space-y-2">
        {members.map((member) => (
          <div 
            key={member.id} 
            className="flex items-center gap-4 p-3 rounded-2xl hover:bg-dark-800/50 transition-colors group/item"
          >
            <Link to={`/user/${member.profiles?.username}`} className="shrink-0">
              <Avatar 
                src={member.profiles?.avatar_url} 
                name={member.profiles?.full_name} 
                size="lg" 
              />
            </Link>
            
            <div className="flex-1 min-w-0">
              <Link to={`/user/${member.profiles?.username}`} className="hover:underline">
                <p className="text-sm font-semibold text-white truncate">
                  {member.profiles?.full_name}
                  {member.user_id === profile?.id && <span className="text-dark-400 font-normal ml-2">(Kamu)</span>}
                </p>
              </Link>
              <p className="text-xs text-dark-400 capitalize">
                {member.role === 'owner' ? 'Pemilik' : member.role}
              </p>
            </div>

            {canKick(member.role, member.user_id) && (
              <button 
                onClick={() => handleKick(member.user_id)}
                className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100 focus:opacity-100"
              >
                Keluarkan
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
