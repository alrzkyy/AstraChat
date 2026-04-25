import { useOutletContext, Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { MoreVertical } from 'lucide-react'

export default function GroupMembersPage() {
  const { members, group, profile } = useOutletContext()

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

            <button className="p-2 text-dark-500 hover:text-white rounded-xl hover:bg-dark-700 transition-colors opacity-0 group-hover/item:opacity-100 focus:opacity-100">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
