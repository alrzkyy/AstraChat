import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import { encryptMessage, decryptMessage, loadOrCreateKey } from '../lib/encryption'
import ChatBubble from '../components/ChatBubble'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import {
  ArrowLeft, Send, Paperclip, X, MessageSquare, Users, StickyNote,
  Shield, FileText, Image as ImageIcon
} from 'lucide-react'
import { validateFile, formatFileSize } from '../lib/utils'

export default function GroupChatPage() {
  const { id: groupId } = useParams()
  const { group, members, profile } = useOutletContext()

  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [encKey, setEncKey] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const membersRef = useRef([])

  // Load encryption key
  useEffect(() => {
    loadOrCreateKey().then(setEncKey)
  }, [])

  // Keep membersRef in sync
  useEffect(() => {
    membersRef.current = members
  }, [members])

  // Realtime subscription
  useEffect(() => {
    if (!groupId || !encKey) return

    const channel = supabase
      .channel(`messages:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `group_id=eq.${groupId}`,
      }, async (payload) => {
        const newMsg = payload.new
        // Decrypt content
        let decryptedContent = ''
        if (newMsg.content && newMsg.iv) {
          decryptedContent = await decryptMessage(newMsg.content, newMsg.iv, encKey)
        } else if (newMsg.content) {
          decryptedContent = newMsg.content
        }

        // Use ref to avoid stale closure
        const currentMembers = membersRef.current
        const senderProfile = currentMembers.find(m => m.user_id === newMsg.sender_id)?.profiles || null

        setMessages(prev => {
          // Prevent duplicate messages
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, { ...newMsg, decryptedContent, senderProfile }]
        })
        scrollToBottom()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId, encKey])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  useEffect(() => {
    if (members && members.length > 0) {
      loadMessages(members)
    }
  }, [members])

  const loadMessages = async (membersList) => {
    try {
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (!messagesData) return

      const key = encKey || await loadOrCreateKey()

      // Decrypt all messages
      const decrypted = await Promise.all(
        messagesData.map(async (msg) => {
          let decryptedContent = ''
          if (msg.content && msg.iv) {
            decryptedContent = await decryptMessage(msg.content, msg.iv, key)
          } else if (msg.content) {
            decryptedContent = msg.content
          }

          const senderProfile = membersList.find(m => m.profiles?.id === msg.sender_id)?.profiles || null

          return { ...msg, decryptedContent, senderProfile }
        })
      )

      setMessages(decrypted)
      scrollToBottom()
    } catch (err) {
      console.error('Load messages error:', err)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedFile) || sending) return

    setSending(true)
    try {
      const key = encKey || await loadOrCreateKey()
      let fileUrl = ''
      let fileName = ''
      let fileSize = 0
      let messageType = 'text'

      // Upload file if selected
      if (selectedFile) {
        setUploading(true)
        const fileExt = selectedFile.name.split('.').pop()
        const filePath = `${groupId}/${profile.id}/${Date.now()}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('chat-files')
          .upload(filePath, selectedFile)

        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(filePath)

        fileUrl = publicUrl
        fileName = selectedFile.name
        fileSize = selectedFile.size
        if (selectedFile.type.startsWith('image/')) messageType = 'image'
        else if (selectedFile.type.startsWith('video/')) messageType = 'video'
        else if (selectedFile.type.startsWith('audio/')) messageType = 'audio'
        else messageType = 'file'
        
        setUploading(false)
      }

      // Encrypt message content
      const textContent = newMessage.trim()
      const { ciphertext, iv } = await encryptMessage(textContent, key)

      // Insert message
      const { error: insertErr } = await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          sender_id: profile.id,
          content: ciphertext,
          iv: iv,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
        })

      if (insertErr) throw insertErr

      setNewMessage('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      inputRef.current?.focus()
    } catch (err) {
      console.error('Send message error:', err)
      alert('Gagal mengirim pesan: ' + err.message)
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validation = validateFile(file, 'chat')
    if (!validation.valid) {
      alert(validation.error)
      e.target.value = ''
      return
    }

    setSelectedFile(file)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Memuat chat..." />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={MessageSquare}
          title="Group tidak ditemukan"
          action={<Link to="/groups" className="px-4 py-2 gradient-bg rounded-xl text-sm text-white">Kembali</Link>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full fade-in relative">
      {/* Background for chat */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{
        backgroundImage: `url(/backgroundchat.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}></div>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-3">
                  <MessageSquare className="w-8 h-8 text-primary-400" />
                </div>
                <p className="text-dark-400 text-sm">Belum ada pesan. Mulai percakapan!</p>
                <p className="text-dark-600 text-xs mt-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Pesan terenkripsi end-to-end
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_id === profile.id}
                  senderProfile={msg.senderProfile}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* File preview */}
          {selectedFile && (
            <div className="px-4 py-2 bg-dark-800 border-t border-dark-700">
              <div className="flex items-center gap-2">
                {selectedFile.type.startsWith('image/') ? (
                  <ImageIcon className="w-5 h-5 text-primary-400" />
                ) : (
                  <FileText className="w-5 h-5 text-primary-400" />
                )}
                <span className="text-sm text-white truncate flex-1">{selectedFile.name}</span>
                <span className="text-xs text-dark-400">{formatFileSize(selectedFile.size)}</span>
                <button
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="p-1 text-dark-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Input area */}
          <form onSubmit={sendMessage} className="flex items-end gap-2 px-4 py-3 bg-dark-900 border-t border-dark-800 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-xl transition-colors shrink-0"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ketik pesan..."
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-white text-sm placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={sending || (!newMessage.trim() && !selectedFile)}
              className="p-2.5 gradient-bg rounded-xl text-white hover:opacity-90 transition-opacity disabled:opacity-30 shrink-0"
            >
              {sending ? <LoadingSpinner size="sm" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
