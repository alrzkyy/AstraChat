import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import { MessageSquare, Users, StickyNote, ArrowRight, Clock, CheckCircle, Circle, Calendar, Plus, Trash2 } from 'lucide-react'
import { formatDate, truncate } from '../lib/utils'
import Modal from '../components/Modal'
import { encryptMessage, loadOrCreateKey } from '../lib/encryption'

export default function DashboardPage() {
  const { profile } = useAuth()
  const [groups, setGroups] = useState([])
  const [recentNotes, setRecentNotes] = useState([])
  const [tasks, setTasks] = useState([])
  const [stats, setStats] = useState({ groups: 0, friends: 0, notes: 0 })
  const [loading, setLoading] = useState(true)

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', deadline: '', group_id: '' })
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)

  // Note Modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [noteForm, setNoteForm] = useState({ title: '', content: '', category: 'Lainnya', group_id: '' })
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)

  useEffect(() => {
    if (!profile) return
    loadData()
  }, [profile])

  const loadData = async () => {
    try {
      // Load groups
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id, groups(id, name, avatar_url, description)')
        .eq('user_id', profile.id)
        .limit(6)

      const groupsList = (memberData || [])
        .map(m => m.groups)
        .filter(Boolean)
      setGroups(groupsList)

      // Load recent notes from user's groups
      const groupIds = groupsList.map(g => g.id)
      if (groupIds.length > 0) {
        const { data: notesData } = await supabase
          .from('notes')
          .select('*, profiles:author_id(full_name, avatar_url), groups:group_id(name)')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })
          .limit(4)
        setRecentNotes(notesData || [])
      }

      // Load tasks
      await loadTasks()

      // Stats
      const { count: groupCount } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)

      const { count: friendCount } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      const { count: noteCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', profile.id)

      setStats({
        groups: groupCount || 0,
        friends: friendCount || 0,
        notes: noteCount || 0,
      })
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*, groups:group_id(name), profiles:created_by(full_name)')
        .order('is_completed', { ascending: true })
        .order('deadline', { ascending: true })
        .limit(10)
      
      setTasks(data || [])
    } catch (err) {
      console.error('Failed to load tasks:', err)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!taskForm.title.trim()) return

    setIsSubmittingTask(true)
    try {
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        created_by: profile.id,
      }
      if (taskForm.deadline) payload.deadline = new Date(taskForm.deadline).toISOString()
      if (taskForm.group_id) {
        payload.group_id = taskForm.group_id
        
        // Share to group chat
        try {
          const encKey = await loadOrCreateKey()
          const deadlineText = taskForm.deadline ? new Date(taskForm.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Tanpa batas waktu'
          const taskData = {
            type: 'task_share',
            title: taskForm.title.trim(),
            description: taskForm.description.trim(),
            deadline: deadlineText,
            rawDeadline: taskForm.deadline || null
          }
          const textContent = JSON.stringify(taskData)
          
          const { ciphertext, iv } = await encryptMessage(textContent, encKey)
          
          await supabase.from('messages').insert({
            group_id: taskForm.group_id,
            sender_id: profile.id,
            content: ciphertext,
            iv: iv,
            message_type: 'task'
          })
        } catch (msgErr) {
          console.error('Failed to send task message to group:', msgErr)
        }
      }

      await supabase.from('tasks').insert(payload)
      setIsTaskModalOpen(false)
      setTaskForm({ title: '', description: '', deadline: '', group_id: '' })
      loadTasks()
    } catch (err) {
      console.error('Failed to create task:', err)
      alert('Gagal membuat tugas')
    } finally {
      setIsSubmittingTask(false)
    }
  }

  const deleteTask = async (taskId) => {
    if (!window.confirm('Yakin ingin menghapus tugas ini?')) return
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err) {
      console.error('Failed to delete task:', err)
      alert('Gagal menghapus tugas')
    }
  }

  const toggleTaskCompletion = async (taskId, currentStatus) => {
    try {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !currentStatus } : t))
      const { error } = await supabase.from('tasks').update({ is_completed: !currentStatus }).eq('id', taskId)
      if (error) throw error
    } catch (err) {
      console.error('Failed to update task:', err)
      loadTasks() 
    }
  }

  const handleCreateNote = async (e) => {
    e.preventDefault()
    if (!noteForm.title.trim() || !noteForm.group_id) return

    setIsSubmittingNote(true)
    try {
      const { error } = await supabase
        .from('notes')
        .insert({
          group_id: noteForm.group_id,
          author_id: profile.id,
          title: noteForm.title.trim(),
          content: noteForm.content.trim(),
          category: noteForm.category,
        })

      if (error) throw error
      setIsNoteModalOpen(false)
      setNoteForm({ title: '', content: '', category: 'Lainnya', group_id: '' })
      loadData()
    } catch (err) {
      console.error('Failed to create note:', err)
      alert('Gagal membuat catatan')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  const getTimeRemaining = (deadlineStr) => {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const now = new Date()
    const diff = deadline - now
    
    if (diff <= 0) return 'Deadline terlewati'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
    
    if (days > 0) return `${days} hari ${hours} jam lagi`
    if (hours > 0) return `${hours} jam ${minutes} mnt lagi`
    return `${minutes} menit lagi`
  }

  const getTaskProgress = (createdAt, deadlineStr) => {
    if (!deadlineStr) return null
    const start = new Date(createdAt).getTime()
    const end = new Date(deadlineStr).getTime()
    const now = new Date().getTime()
    
    if (now >= end) return 100
    if (now <= start) return 0
    
    const progress = ((now - start) / (end - start)) * 100
    return Math.min(Math.max(progress, 0), 100)
  }

  const formatDeadline = (dateString) => {

    if (!dateString) return null
    const date = new Date(dateString)
    const now = new Date()
    const isPast = date < now && date.toDateString() !== now.toDateString()
    const isToday = date.toDateString() === now.toDateString()
    
    let text = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    if (isToday) text = 'Hari ini'
    
    return { text, isPast, isToday }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 19) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Memuat dashboard..." />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto fade-in">
      {/* Header / Greeting */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-dark-400 mt-1">Berikut adalah ringkasan aktivitas Anda hari ini.</p>
        </div>
        
        <Link 
          to="/profile" 
          className="flex items-center gap-3 p-1.5 pr-4 rounded-full bg-dark-800/40 hover:bg-dark-700/60 border border-dark-700/50 transition-all group shrink-0"
        >
          <Avatar 
            src={profile?.avatar_url} 
            name={profile?.full_name} 
            size="md" 
            className="ring-2 ring-transparent group-hover:ring-primary-500/50 transition-all" 
          />
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold text-white leading-tight">{profile?.full_name}</p>
            <p className="text-xs text-dark-400 leading-tight">@{profile?.username}</p>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Users, label: 'Teman', value: stats.friends, color: 'from-blue-500 to-cyan-500' },
          { icon: MessageSquare, label: 'Groups', value: stats.groups, color: 'from-primary-500 to-indigo-500' },
          { icon: StickyNote, label: 'Catatan', value: stats.notes, color: 'from-pink-500 to-rose-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-card rounded-2xl p-5 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:opacity-10 transition-opacity`}></div>
            <div className="flex items-start justify-between mb-2">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-white">{value}</span>
            </div>
            <p className="text-sm font-medium text-dark-300 mt-2">{label}</p>
          </div>
        ))}
      </div>

      {/* Groups section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Group Kamu</h2>
          <Link to="/groups" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
            Lihat semua <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <p className="text-dark-400">Belum ada group. <Link to="/groups" className="text-primary-400">Buat atau join group</Link></p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {groups.map(group => (
              <Link
                key={group.id}
                to={`/groups/${group.id}/chat`}
                className="glass-card glass-card-hover rounded-xl p-4 transition-all duration-200"
              >
                <Avatar src={group.avatar_url} name={group.name} size="lg" className="mb-3" />
                <h3 className="text-sm font-semibold text-white truncate">{group.name}</h3>
                <p className="text-xs text-dark-500 truncate mt-0.5">{group.description || 'Group belajar'}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Notes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Catatan Terbaru</h2>
          <button 
            onClick={() => setIsNoteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        {recentNotes.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <p className="text-dark-400">Belum ada catatan terbaru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentNotes.map(note => (
              <Link
                key={note.id}
                to={`/groups/${note.group_id}/notes`}
                className="glass-card glass-card-hover rounded-xl p-4 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400">
                    {note.category}
                  </span>
                  <span className="text-xs text-dark-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(note.created_at)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{note.title}</h3>
                <p className="text-xs text-dark-400">{truncate(note.content, 80)}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Avatar src={note.profiles?.avatar_url} name={note.profiles?.full_name} size="xs" />
                  <span className="text-xs text-dark-500">{note.profiles?.full_name}</span>
                  {note.groups?.name && (
                    <span className="text-xs text-dark-600">• {note.groups.name}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tasks Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Tugas & Deadline</h2>
          <button 
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 gradient-bg rounded-lg text-sm text-white font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center border border-dashed border-dark-700">
            <div className="w-12 h-12 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-dark-500" />
            </div>
            <p className="text-dark-300 font-medium mb-1">Semua tugas selesai!</p>
            <p className="text-sm text-dark-500">Tida ada tugas yang tertunda. Nikmati waktu luangmu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map(task => {
              const deadline = formatDeadline(task.deadline)
              return (
                <div 
                  key={task.id} 
                  className={`glass-card rounded-xl p-4 transition-all duration-200 border-l-4 ${task.is_completed ? 'border-l-green-500 opacity-60' : 'border-l-primary-500'}`}
                >
                  <div className="flex gap-3">
                    <button 
                      onClick={() => toggleTaskCompletion(task.id, task.is_completed)}
                      className="mt-0.5 shrink-0 text-dark-400 hover:text-green-400 transition-colors"
                    >
                      {task.is_completed ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-sm font-medium ${task.is_completed ? 'text-dark-400 line-through' : 'text-white'}`}>
                          {task.title}
                        </h3>
                        {task.created_by === profile.id && (
                          <button onClick={() => deleteTask(task.id)} className="text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className={`text-xs mt-1 ${task.is_completed ? 'text-dark-600' : 'text-dark-400'}`}>
                          {truncate(task.description, 60)}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        {deadline && (
                          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] uppercase font-bold tracking-wider ${
                                task.is_completed ? 'text-dark-500' : 
                                deadline.isPast ? 'text-red-400' : 
                                deadline.isToday ? 'text-yellow-400' : 'text-primary-400'
                              }`}>
                                <Calendar className="w-3 h-3 inline mr-1" /> {deadline.text}
                              </span>
                              {!task.is_completed && (
                                <span className="text-[10px] text-dark-400 font-medium italic">
                                  {getTimeRemaining(task.deadline)}
                                </span>
                              )}
                            </div>
                            
                            {/* Progress Bar */}
                            {!task.is_completed && (
                              <div className="w-full h-1.5 bg-dark-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-1000 ${
                                    deadline.isPast ? 'bg-red-500' : 
                                    deadline.isToday ? 'bg-yellow-500' : 'bg-primary-500'
                                  }`}
                                  style={{ width: `${getTaskProgress(task.created_at, task.deadline)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                        
                        {task.groups?.name && (
                          <span className="text-xs flex items-center gap-1 text-primary-400 bg-primary-500/10 px-2 py-1 rounded-lg border border-primary-500/10">
                            <Users className="w-3 h-3" /> {task.groups.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Buat Tugas Baru"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Judul Tugas</label>
            <input
              type="text"
              required
              value={taskForm.title}
              onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Contoh: Mengerjakan PR Matematika"
              className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Deskripsi (Opsional)</label>
            <textarea
              value={taskForm.description}
              onChange={e => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detail tugas..."
              rows={3}
              className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center justify-between text-sm font-medium text-dark-300 mb-1.5">
                Tenggat Waktu
                {taskForm.deadline && (
                  <button 
                    type="button" 
                    onClick={() => setTaskForm(prev => ({ ...prev, deadline: '' }))}
                    className="text-[10px] text-red-400 hover:underline"
                  >
                    Hapus
                  </button>
                )}
              </label>
              <input
                type="date"
                value={taskForm.deadline}
                onChange={e => setTaskForm(prev => ({ ...prev, deadline: e.target.value }))}
                className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Bagikan ke Group</label>
              <select
                value={taskForm.group_id}
                onChange={e => setTaskForm(prev => ({ ...prev, group_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors"
              >
                <option value="">-- Pribadi --</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              className="px-4 py-2 text-dark-300 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingTask}
              className="px-5 py-2 gradient-bg rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSubmittingTask ? 'Menyimpan...' : 'Simpan Tugas'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Note Modal */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title="Buat Catatan Baru"
      >
        <form onSubmit={handleCreateNote} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Judul Catatan</label>
            <input
              type="text"
              required
              value={noteForm.title}
              onChange={e => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Judul catatan..."
              className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Kategori</label>
              <select
                value={noteForm.category}
                onChange={e => setNoteForm(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors"
              >
                <option value="Matematika">Matematika</option>
                <option value="Biologi">Biologi</option>
                <option value="Fisika">Fisika</option>
                <option value="Kimia">Kimia</option>
                <option value="Sejarah">Sejarah</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Pilih Group</label>
              <select
                required
                value={noteForm.group_id}
                onChange={e => setNoteForm(prev => ({ ...prev, group_id: e.target.value }))}
                className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 transition-colors"
              >
                <option value="">-- Pilih Group --</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Konten</label>
            <textarea
              value={noteForm.content}
              onChange={e => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Tulis catatan..."
              rows={5}
              className="w-full px-4 py-2.5 bg-dark-900 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
            <button
              type="button"
              onClick={() => setIsNoteModalOpen(false)}
              className="px-4 py-2 text-dark-300 hover:text-white transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingNote || !noteForm.group_id}
              className="px-5 py-2 gradient-bg rounded-xl text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSubmittingNote ? 'Menyimpan...' : 'Buat Catatan'}
            </button>
          </div>
        </form>
      </Modal>

    </div>

  )
}
