import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import {
  PhoneOff, Mic, MicOff, Video, VideoOff,
  Phone, Maximize2, Minimize2
} from 'lucide-react'

export default function CallScreen({
  callState, callType, remoteUser,
  localStream, remoteStream,
  isMuted, isCameraOff, callDuration,
  endCall, toggleMute, toggleCamera
}) {

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const isVideoCall = callType === 'video'
  const isCalling = callState === 'calling'
  const isConnected = callState === 'connected'

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] bg-dark-950 flex flex-col"
      style={{ touchAction: 'none' }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-dark-900 via-dark-950 to-indigo-950 opacity-80" />

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-10">
        {/* Video call: remote video fullscreen */}
        {isVideoCall && isConnected && remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Voice call or waiting: show avatar */}
        {(!isVideoCall || isCalling || !remoteStream) && (
          <div className="flex flex-col items-center text-center px-4">
            {/* Animated ring */}
            <div className="relative mb-6">
              {isCalling && (
                <>
                  <div className="absolute inset-0 w-28 h-28 -m-2 rounded-full bg-primary-500/20 animate-ping" />
                  <div className="absolute inset-0 w-28 h-28 -m-2 rounded-full bg-primary-500/10 animate-pulse" />
                </>
              )}
              <Avatar
                src={remoteUser?.avatar_url}
                name={remoteUser?.full_name}
                size="2xl"
                className="w-24 h-24 ring-4 ring-primary-500/30 shadow-2xl"
              />
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">
              {remoteUser?.full_name || 'Unknown'}
            </h2>
            <p className="text-dark-400 text-sm mb-2">
              @{remoteUser?.username}
            </p>

            {isCalling && (
              <p className="text-primary-400 text-sm animate-pulse mt-2">
                Memanggil...
              </p>
            )}

            {isConnected && (
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-green-400 text-sm font-medium">
                  {formatDuration(callDuration)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Video call connected: show duration overlay */}
        {isVideoCall && isConnected && remoteStream && (
          <div className="absolute top-6 left-0 right-0 flex justify-center z-20">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-white text-sm font-medium">
                {formatDuration(callDuration)}
              </span>
              <span className="text-dark-300 text-xs">
                • {remoteUser?.full_name}
              </span>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        {isVideoCall && localStream && (
          <div className="absolute top-20 right-4 z-30 w-32 h-44 sm:w-40 sm:h-56 rounded-2xl overflow-hidden border-2 border-dark-700 shadow-2xl bg-dark-900">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
            />
            {isCameraOff && (
              <div className="w-full h-full flex items-center justify-center bg-dark-800">
                <VideoOff className="w-8 h-8 text-dark-500" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="relative z-20 pb-12 pt-6 px-4">
        <div className="flex items-center justify-center gap-4">
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
              isMuted
                ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30'
                : 'bg-dark-800/80 text-white hover:bg-dark-700/80'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Camera toggle (video call only) */}
          {isVideoCall && (
            <button
              onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                isCameraOff
                  ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30'
                  : 'bg-dark-800/80 text-white hover:bg-dark-700/80'
              }`}
              title={isCameraOff ? 'Nyalakan Kamera' : 'Matikan Kamera'}
            >
              {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {/* End call */}
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-red-500/30 active:scale-95"
            title="Akhiri Panggilan"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Fullscreen toggle */}
          {isVideoCall && (
            <button
              onClick={toggleFullscreen}
              className="w-14 h-14 rounded-full bg-dark-800/80 text-white hover:bg-dark-700/80 flex items-center justify-center transition-all duration-200"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
            </button>
          )}
        </div>

        {/* Call type label */}
        <p className="text-center text-dark-500 text-xs mt-4 uppercase tracking-wider">
          {isVideoCall ? 'Video Call' : 'Voice Call'}
        </p>
      </div>
    </div>
  )
}
