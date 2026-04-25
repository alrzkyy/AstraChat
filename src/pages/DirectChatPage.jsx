import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { useCall } from '../components/CallProvider'
import { supabase } from '../lib/supabase'
import { encryptMessage, decryptMessage, loadOrCreateKey } from '../lib/encryption'
import ChatBubble from '../components/ChatBubble'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  ArrowLeft, Send, Paperclip, X, MessageCircle,
  Shield, FileText, Image as ImageIcon, Phone, Video
} from 'lucide-react'
import { validateFile, formatFileSize } from '../lib/utils'

export default function DirectChatPage() {
  const { conversationId } = useParams()
  const { profile } = useAuth()
  const { startCall } = useCall()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [encKey, setEncKey] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [otherUser, setOtherUser] = useState(null)
  const [conversation, setConversation] = useState(null)

  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)

  // Load encryption key
  useEffect(() => {
    loadOrCreateKey().then(setEncKey)
  }, [])

  // Load conversation data
  useEffect(() => {
    if (!profile || !conversationId) return
    loadConversation()
  }, [profile, conversationId])

  // Realtime subscription
  useEffect(() => {
    if (!conversationId || !encKey) return

    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const newMsg = payload.new
        let decryptedContent = ''
        if (newMsg.content && newMsg.iv) {
          decryptedContent = await decryptMessage(newMsg.content, newMsg.iv, encKey)
        } else if (newMsg.content) {
          decryptedContent = newMsg.content
        }

        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, { ...newMsg, decryptedContent }]
        })
        scrollToBottom()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, encKey])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const loadConversation = async () => {
    try {
      // Get conversation details
      const { data: conv, error: convErr } = await supabase
        .from('direct_conversations')
        .select(`
          *,
          user1:user1_id(id, full_name, username, avatar_url),
          user2:user2_id(id, full_name, username, avatar_url)
        `)
        .eq('id', conversationId)
        .single()

      if (convErr || !conv) {
        navigate('/dm')
        return
      }

      setConversation(conv)
      const other = conv.user1_id === profile.id ? conv.user2 : conv.user1
      setOtherUser(other)

      // Load messages
      const { data: messagesData } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (!messagesData) return

      const key = encKey || await loadOrCreateKey()

      const decrypted = await Promise.all(
        messagesData.map(async (msg) => {
          let decryptedContent = ''
          if (msg.content && msg.iv) {
            decryptedContent = await decryptMessage(msg.content, msg.iv, key)
          } else if (msg.content) {
            decryptedContent = msg.content
          }
          return { ...msg, decryptedContent }
        })
      )

      setMessages(decrypted)
      scrollToBottom()
    } catch (err) {
      console.error('Load conversation error:', err)
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

      if (selectedFile) {
        setUploading(true)
        const fileExt = selectedFile.name.split('.').pop()
        const filePath = `dm/${conversationId}/${profile.id}/${Date.now()}.${fileExt}`

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

      const textContent = newMessage.trim()
      const { ciphertext, iv } = await encryptMessage(textContent, key)

      const { error: insertErr } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: profile.id,
          content: ciphertext,
          iv: iv,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
        })

      if (insertErr) throw insertErr

      // Update conversation timestamp
      await supabase
        .from('direct_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)

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

  return (
    <div className="flex flex-col h-full fade-in relative">
      {/* Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{
        backgroundImage: `url(/backgroundchat.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}></div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-900 border-b border-dark-800 shrink-0 relative z-10 shadow-sm">
        <button onClick={() => navigate('/dm')} className="p-1 text-dark-400 hover:text-white transition-colors rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Avatar src={otherUser?.avatar_url} name={otherUser?.full_name} size="md" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{otherUser?.full_name}</h2>
          <p className="text-xs text-dark-400">@{otherUser?.username}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => otherUser && startCall(otherUser, 'voice')}
            className="p-2.5 text-dark-400 hover:text-green-400 hover:bg-dark-800 rounded-xl transition-colors"
            title="Voice Call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => otherUser && startCall(otherUser, 'video')}
            className="p-2.5 text-dark-400 hover:text-primary-400 hover:bg-dark-800 rounded-xl transition-colors"
            title="Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden relative z-10">
        <div ref={chatContainerRef} className="h-full overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-3">
                <MessageCircle className="w-8 h-8 text-primary-400" />
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
                senderProfile={msg.sender_id === profile.id ? profile : otherUser}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* File preview */}
      {selectedFile && (
        <div className="px-4 py-2 bg-dark-800 border-t border-dark-700 relative z-10">
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
      <form onSubmit={sendMessage} className="flex items-end gap-2 px-4 py-3 bg-dark-900 border-t border-dark-800 shrink-0 relative z-10">
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
  )
}
