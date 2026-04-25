import Avatar from './Avatar'
import { Phone, PhoneOff, Video } from 'lucide-react'

export default function IncomingCallModal({ callerProfile, callType, onAccept, onReject }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ touchAction: 'none' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 bg-dark-900 border border-dark-700 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl slide-up">
        {/* Caller avatar with ring animation */}
        <div className="relative w-24 h-24 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-green-500/10 animate-pulse" />
          <Avatar
            src={callerProfile?.avatar_url}
            name={callerProfile?.full_name}
            size="2xl"
            className="w-24 h-24 ring-4 ring-green-500/30 shadow-xl relative z-10"
          />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">
          {callerProfile?.full_name || 'Seseorang'}
        </h2>
        <p className="text-sm text-dark-400 mb-1">
          @{callerProfile?.username}
        </p>
        <p className="text-primary-400 text-sm mb-8 animate-pulse">
          {callType === 'video' ? '📹 Video Call Masuk...' : '📞 Panggilan Masuk...'}
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-6">
          {/* Reject */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-red-500/30 active:scale-95"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs text-dark-400">Tolak</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-green-500/30 active:scale-95 animate-bounce"
            >
              {callType === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
            <span className="text-xs text-dark-400">Terima</span>
          </div>
        </div>
      </div>
    </div>
  )
}
