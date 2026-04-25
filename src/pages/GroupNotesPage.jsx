import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import SearchInput from '../components/SearchInput'
import {
  ArrowLeft, Plus, StickyNote, FileText, Download, Trash2,
  Edit3, MessageSquare, Filter, Send, AlertCircle, CheckCircle, X
} from 'lucide-react'
import { formatDate, formatFileSize, truncate, NOTE_CATEGORIES, validateFile } from '../lib/utils'

export default function GroupNotesPage() {
  const { group, profile } = useOutletContext()
  const groupId = group?.id

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editNote, setEditNote] = useState(null)
  const [viewNote, setViewNote] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [toast, setToast] = useState('')

  const showToastMsg = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Create/Edit form
  const [form, setForm] = useState({ title: '', content: '', category: 'Lainnya' })
  const [noteFile, setNoteFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (groupId) loadNotes()
  }, [groupId])

  const loadNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*, profiles:author_id(id, full_name, username, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    setNotes(data || [])
    setLoading(false)
  }

  const loadComments = async (noteId) => {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:author_id(id, full_name, avatar_url)')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true })

    setComments(data || [])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return

    setSubmitting(true)
    try {
      let fileUrl = ''
      let fileName = ''
      let fileSize = 0

      if (noteFile) {
        const fileExt = noteFile.name.split('.').pop()
        const filePath = `${groupId}/${profile.id}/${Date.now()}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('note-files')
          .upload(filePath, noteFile)

        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from('note-files')
          .getPublicUrl(filePath)

        fileUrl = publicUrl
        fileName = noteFile.name
        fileSize = noteFile.size
      }

      if (editNote) {
        // Update
        const updateData = {
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category,
        }
        if (fileUrl) {
          updateData.file_url = fileUrl
          updateData.file_name = fileName
          updateData.file_size = fileSize
        }

        const { error } = await supabase
          .from('notes')
          .update(updateData)
          .eq('id', editNote.id)

        if (error) throw error
        showToastMsg('Catatan diperbarui!')
      } else {
        // Create
        const { error } = await supabase
          .from('notes')
          .insert({
            group_id: groupId,
            author_id: profile.id,
            title: form.title.trim(),
            content: form.content.trim(),
            category: form.category,
            file_url: fileUrl,
            file_name: fileName,
            file_size: fileSize,
          })

        if (error) throw error
        showToastMsg('Catatan berhasil dibuat!')
      }

      setShowCreate(false)
      setEditNote(null)
      setForm({ title: '', content: '', category: 'Lainnya' })
      setNoteFile(null)
      loadNotes()
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteNote = async (noteId) => {
    if (!confirm('Hapus catatan ini?')) return
    try {
      await supabase.from('notes').delete().eq('id', noteId)
      showToastMsg('Catatan dihapus')
      setViewNote(null)
      loadNotes()
    } catch (err) {
      alert('Gagal menghapus: ' + err.message)
    }
  }

  const addComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !viewNote) return

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          note_id: viewNote.id,
          author_id: profile.id,
          content: newComment.trim(),
        })

      if (error) throw error
      setNewComment('')
      loadComments(viewNote.id)
    } catch (err) {
      alert('Gagal mengirim komentar: ' + err.message)
    }
  }

  const deleteComment = async (commentId) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId)
      if (viewNote) loadComments(viewNote.id)
    } catch (err) {
      console.error('Delete comment error:', err)
    }
  }

  const openNote = async (note) => {
    setViewNote(note)
    await loadComments(note.id)
  }

  const openEdit = (note) => {
    setEditNote(note)
    setForm({ title: note.title, content: note.content, category: note.category })
    setShowCreate(true)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validation = validateFile(file, 'note')
    if (!validation.valid) {
      alert(validation.error)
      e.target.value = ''
      return
    }
    setNoteFile(file)
  }

  const filteredNotes = notes.filter(n => {
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !category || n.category === category
    return matchSearch && matchCategory
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Memuat catatan..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full fade-in relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 p-3 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white shadow-lg slide-up">
          <CheckCircle className="w-4 h-4 text-green-400" /> {toast}
        </div>
      )}

      {/* Filters and Create Button */}
      <div className="px-4 py-3 flex gap-2 flex-wrap shrink-0 items-center border-b border-dark-800/50">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari catatan..." className="flex-1 min-w-[200px]" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white focus:outline-none focus:border-primary-500"
        >
          <option value="">Semua Kategori</option>
          {NOTE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          onClick={() => { setEditNote(null); setForm({ title: '', content: '', category: 'Lainnya' }); setNoteFile(null); setShowCreate(true) }}
          className="flex items-center gap-1 px-4 py-2.5 gradient-bg rounded-xl text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Buat Catatan
        </button>
      </div>


      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredNotes.length === 0 ? (
          <EmptyState
            icon={StickyNote}
            title={search || category ? 'Tidak ditemukan' : 'Belum ada catatan'}
            description="Buat catatan pertama untuk group ini"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => openNote(note)}
                className="glass-card glass-card-hover rounded-xl p-4 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400">
                    {note.category}
                  </span>
                  <span className="text-xs text-dark-500">{formatDate(note.created_at)}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{note.title}</h3>
                <p className="text-xs text-dark-400 mb-3">{truncate(note.content, 100)}</p>
                {note.file_name && (
                  <div className="flex items-center gap-1.5 text-xs text-dark-500 mb-2">
                    <FileText className="w-3 h-3" />
                    <span className="truncate">{note.file_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Avatar src={note.profiles?.avatar_url} name={note.profiles?.full_name} size="xs" />
                  <span className="text-xs text-dark-500">{note.profiles?.full_name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditNote(null) }}
        title={editNote ? 'Edit Catatan' : 'Buat Catatan'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Judul</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Judul catatan"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Kategori</label>
            <select
              value={form.category}
              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500"
            >
              {NOTE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Konten</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Tulis catatan..."
              rows={5}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">File (opsional)</label>
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx"
              className="w-full text-sm text-dark-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-dark-700 file:text-white hover:file:bg-dark-600"
            />
            {noteFile && (
              <p className="text-xs text-dark-400 mt-1">{noteFile.name} ({formatFileSize(noteFile.size)})</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !form.title.trim()}
            className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : (editNote ? 'Perbarui' : 'Buat Catatan')}
          </button>
        </form>
      </Modal>

      {/* View Note Modal */}
      <Modal
        isOpen={!!viewNote}
        onClose={() => setViewNote(null)}
        title={viewNote?.title || 'Catatan'}
        size="lg"
      >
        {viewNote && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400">
                {viewNote.category}
              </span>
              <span className="text-xs text-dark-500">{formatDate(viewNote.created_at)}</span>
              <div className="flex-1" />
              {viewNote.author_id === profile.id && (
                <>
                  <button
                    onClick={() => { setViewNote(null); openEdit(viewNote) }}
                    className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-700 rounded-lg"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteNote(viewNote.id)}
                    className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Avatar src={viewNote.profiles?.avatar_url} name={viewNote.profiles?.full_name} size="sm" />
              <span className="text-sm text-dark-300">{viewNote.profiles?.full_name}</span>
            </div>

            <div className="text-sm text-dark-200 leading-relaxed whitespace-pre-wrap bg-dark-800 rounded-xl p-4">
              {viewNote.content || 'Tidak ada konten.'}
            </div>

            {viewNote.file_url && (
              <div className="space-y-2">
                {/* Check if image */}
                {viewNote.file_name && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(viewNote.file_name) ? (
                  <div className="rounded-xl overflow-hidden border border-dark-700 bg-dark-800">
                    <img 
                      src={viewNote.file_url} 
                      className="w-full h-auto max-h-[400px] object-contain cursor-zoom-in" 
                      alt={viewNote.file_name} 
                      onClick={() => window.open(viewNote.file_url, '_blank')}
                    />
                  </div>
                ) : (
                  <a
                    href={viewNote.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-primary-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{viewNote.file_name}</p>
                      <p className="text-xs text-dark-500">{formatFileSize(viewNote.file_size)}</p>
                    </div>
                    <Download className="w-4 h-4 text-dark-400" />
                  </a>
                )}
              </div>
            )}

            {/* Comments */}
            <div className="border-t border-dark-700 pt-4">
              <h4 className="text-sm font-semibold text-dark-300 mb-3">Komentar ({comments.length})</h4>

              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-2 p-2 rounded-lg bg-dark-800/50">
                    <Avatar src={comment.profiles?.avatar_url} name={comment.profiles?.full_name} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{comment.profiles?.full_name}</span>
                        <span className="text-[10px] text-dark-500">{formatDate(comment.created_at)}</span>
                        {comment.author_id === profile.id && (
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="ml-auto text-dark-500 hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-dark-300 mt-0.5">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-xs text-dark-500 text-center py-2">Belum ada komentar</p>
                )}
              </div>

              <form onSubmit={addComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Tulis komentar..."
                  className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2 gradient-bg rounded-lg text-white disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
