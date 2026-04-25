import Avatar from './Avatar'
import { formatTime, formatFileSize } from '../lib/utils'
import { FileText, Download, CheckCheck, Check, ClipboardList, Clock, Info } from 'lucide-react'

// Simple formatter for whatsapp-style text
const formatMessageText = (text) => {
  if (!text) return null
  const parts = text.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={index}>{part.slice(1, -1)}</strong>
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('~') && part.endsWith('~') && part.length > 2) {
      return <del key={index}>{part.slice(1, -1)}</del>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={index} className="bg-black/20 px-1.5 py-0.5 rounded font-mono text-sm">{part.slice(1, -1)}</code>
    }
    return part
  })
}

export default function ChatBubble({ message, isOwn, senderProfile }) {
  const isFile = message.message_type !== 'text' && !!message.file_url
  const isImage = message.message_type === 'image' || 
    (message.file_name && /\.(jpg|jpeg|png|webp|gif)$/i.test(message.file_name))
  const isVideo = message.message_type === 'video' ||
    (message.file_name && /\.(mp4|webm|ogg|mov)$/i.test(message.file_name))
  const isAudio = message.message_type === 'audio' ||
    (message.file_name && /\.(mp3|wav|ogg|m4a)$/i.test(message.file_name))

  let taskData = null
  let countdownText = null
  let isPastDeadline = false

  if (message.message_type === 'task' && message.decryptedContent) {
    try {
      taskData = JSON.parse(message.decryptedContent)
      if (taskData.rawDeadline) {
        const deadlineDate = new Date(taskData.rawDeadline)
        const diff = deadlineDate - new Date()
        if (diff < 0) {
          isPastDeadline = true
          countdownText = 'Waktu Habis'
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24))
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          if (days > 0) {
            countdownText = `${days} hari lagi`
          } else if (hours > 0) {
            countdownText = `${hours} jam lagi`
          } else {
            countdownText = 'Kurang dari 1 jam'
          }
        }
      }
    } catch (e) {
      // Legacy or plain text
    }
  }

  return (
    <div className={`flex gap-2.5 mb-3 chat-bubble-enter ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && (
        <Avatar
          src={senderProfile?.avatar_url}
          name={senderProfile?.full_name}
          size="sm"
          className="mt-1"
        />
      )}
      
      <div className={`max-w-[75%] md:max-w-[60%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <p className="text-xs text-primary-400 font-medium mb-1 px-1">
            {senderProfile?.full_name || 'User'}
          </p>
        )}
        
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn
              ? 'bg-primary-600 text-white rounded-tr-md'
              : 'bg-dark-800 text-dark-100 rounded-tl-md'
          }`}
        >
          {/* Text content */}
          {message.decryptedContent && !taskData && message.decryptedContent !== `📎 ${message.file_name}` && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {formatMessageText(message.decryptedContent)}
            </div>
          )}

          {/* Task Card content */}
          {taskData && (
            <div className={`mt-1 mb-2 p-3 rounded-xl border ${isOwn ? 'bg-primary-700/50 border-primary-500/30' : 'bg-dark-900 border-dark-700'} min-w-[200px]`}>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                <div className="p-1.5 bg-primary-500/20 rounded-lg text-primary-300 shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-sm line-clamp-1">{taskData.title}</h4>
              </div>
              {taskData.description && (
                <div className="flex gap-2 mb-2 text-white/80">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
                  <p className="text-xs line-clamp-2 leading-relaxed">{taskData.description}</p>
                </div>
              )}
              <div className="flex gap-2 text-white/80">
                <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{taskData.deadline}</p>
                  {countdownText && (
                    <p className={`text-[10px] mt-0.5 font-bold ${isPastDeadline ? 'text-red-400' : 'text-yellow-400'}`}>
                      {countdownText}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* File attachment */}
          {isFile && (
            <div className="mt-1">
              {isImage ? (
                <img
                  src={message.file_url}
                  alt={message.file_name || 'Image'}
                  className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
                  onClick={() => window.open(message.file_url, '_blank')}
                />
              ) : isVideo ? (
                <video
                  src={message.file_url}
                  controls
                  className="rounded-lg max-w-full max-h-64 outline-none"
                />
              ) : isAudio ? (
                <audio
                  src={message.file_url}
                  controls
                  className="max-w-[200px] md:max-w-[250px] outline-none"
                />
              ) : (
                <a
                  href={message.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    isOwn ? 'bg-primary-700/50 hover:bg-primary-700/70' : 'bg-dark-700 hover:bg-dark-600'
                  } transition-colors`}
                >
                  <FileText className="w-8 h-8 text-primary-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{message.file_name}</p>
                    <p className="text-xs opacity-70">{formatFileSize(message.file_size)}</p>
                  </div>
                  <Download className="w-4 h-4 shrink-0 opacity-70" />
                </a>
              )}
            </div>
          )}

          <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-primary-200' : 'text-dark-500'}`}>
            <p className="text-[10px]">
              {formatTime(message.created_at)}
            </p>
            {isOwn && message.status === 'read' && (
              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
            )}
            {isOwn && message.status === 'delivered' && (
              <CheckCheck className="w-3.5 h-3.5 text-white/70" />
            )}
            {isOwn && (message.status === 'sent' || !message.status) && (
              <Check className="w-3.5 h-3.5 text-white/70" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
