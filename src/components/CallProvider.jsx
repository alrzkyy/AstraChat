import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { createPeerConnection, getUserMedia, stopStream } from '../lib/webrtc'
import CallScreen from './CallScreen'
import IncomingCallModal from './IncomingCallModal'

const CallContext = createContext(null)

export function useCall() {
  return useContext(CallContext)
}

/**
 * Call Provider — handles WebRTC call lifecycle via Supabase Realtime Broadcast.
 * 
 * Signaling flow:
 * 1. Caller → Callee: 'call-invite' (with caller profile + call type)
 * 2. Caller → Callee: 'call-offer' (SDP offer)
 * 3. Callee → Caller: 'call-answer' (SDP answer) 
 * 4. Both: 'ice-candidate' (ICE candidates)
 * 5. Either: 'call-end' or 'call-reject'
 */
export function CallProvider({ children }) {
  const { user, profile } = useAuth()
  
  const [callState, setCallState] = useState('idle')
  const [callType, setCallType] = useState('voice')
  const [remoteUser, setRemoteUser] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  const peerConnectionRef = useRef(null)
  const remoteUserIdRef = useRef(null)
  const iceCandidatesQueue = useRef([])
  const durationIntervalRef = useRef(null)
  const ringtoneRef = useRef(null)
  const callStateRef = useRef('idle')
  const pendingOfferRef = useRef(null)

  // Keep ref in sync with state
  useEffect(() => {
    callStateRef.current = callState
  }, [callState])

  // ===================== SIGNALING CHANNEL =====================
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel(`user-calls:${user.id}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'call-invite' }, ({ payload }) => {
        if (callStateRef.current !== 'idle') {
          // Busy — auto-reject
          sendSignal(payload.callerId, 'call-reject', { reason: 'busy' })
          return
        }
        
        setCallState('incoming')
        setCallType(payload.callType || 'voice')
        setRemoteUser(payload.callerProfile)
        remoteUserIdRef.current = payload.callerId
        pendingOfferRef.current = null
        playRingtone()
      })
      .on('broadcast', { event: 'call-offer' }, async ({ payload }) => {
        // If incoming and PC not ready yet, queue the offer
        if (!peerConnectionRef.current) {
          pendingOfferRef.current = payload
          return
        }
        await handleOfferRef.current(payload)
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        const pc = peerConnectionRef.current
        if (!pc) return
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
          
          // Flush ICE candidates using the queue directly
          while (iceCandidatesQueue.current.length > 0) {
            const candidate = iceCandidatesQueue.current.shift()
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e))
          }
        } catch (err) {
          console.error('Error handling answer:', err)
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        const pc = peerConnectionRef.current
        if (!pc) return
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } else {
            iceCandidatesQueue.current.push(payload.candidate)
          }
        } catch (err) {
          console.error('Error adding ICE candidate:', err)
        }
      })
      .on('broadcast', { event: 'call-reject' }, () => {
        doCleanup()
        setCallState('idle')
      })
      .on('broadcast', { event: 'call-end' }, () => {
        doCleanup()
        setCallState('idle')
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // ===================== DURATION TIMER =====================
  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0)
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
  }, [callState])

  // ===================== HELPERS =====================
  const sendSignal = useCallback((targetUserId, event, payload = {}) => {
    const ch = supabase.channel(`user-calls:${targetUserId}`, {
      config: { broadcast: { self: false } },
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event, payload })
        setTimeout(() => supabase.removeChannel(ch), 500)
      }
    })
  }, [])

  const flushIceCandidates = useCallback(async (pc) => {
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift()
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (e) {
        console.warn('Failed to add ICE candidate:', e)
      }
    }
  }, [])

  const handleOffer = useCallback(async (payload) => {
    const pc = peerConnectionRef.current
    if (!pc) return
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal(payload.callerId, 'call-answer', { answer })
      await flushIceCandidates(pc)
    } catch (err) {
      console.error('Error handling offer:', err)
    }
  }, [sendSignal, flushIceCandidates])

  // Keep a ref to handleOffer so useEffect can use the latest version without re-subscribing
  const handleOfferRef = useRef(handleOffer)
  useEffect(() => {
    handleOfferRef.current = handleOffer
  }, [handleOffer])

  const playRingtone = () => {
    try {
      if (ringtoneRef.current) return // Already playing
      const audio = new Audio('/kuru-kuru-kururing.mp3')
      audio.loop = true
      audio.play().catch(e => console.warn('Autoplay prevented:', e))
      ringtoneRef.current = { audio, stopped: false }
    } catch (e) {
      console.error('Failed to play ringtone', e)
    }
  }

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stopped = true
      try {
        if (ringtoneRef.current.audio) {
          ringtoneRef.current.audio.pause()
          ringtoneRef.current.audio.currentTime = 0
        }
      } catch (e) {}
      ringtoneRef.current = null
    }
  }

  // ===================== PEER CONNECTION SETUP =====================
  const setupPeerConnection = useCallback(async (callTypeParam) => {
    const pc = createPeerConnection()
    peerConnectionRef.current = pc

    const remote = new MediaStream()
    setRemoteStream(remote)

    const isVideo = callTypeParam === 'video'
    const stream = await getUserMedia(isVideo, true)
    setLocalStream(stream)

    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => remote.addTrack(track))
      setRemoteStream(new MediaStream(remote.getTracks()))
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserIdRef.current) {
        sendSignal(remoteUserIdRef.current, 'ice-candidate', {
          candidate: event.candidate.toJSON(),
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall()
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState('connected')
      }
    }

    return pc
  }, [sendSignal])

  // ===================== CALL ACTIONS =====================
  const doCleanup = useCallback(() => {
    stopRingtone()
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    stopStream(localStream)
    setLocalStream(null)
    setRemoteStream(null)
    setRemoteUser(null)
    setIsMuted(false)
    setIsCameraOff(false)
    setCallDuration(0)
    iceCandidatesQueue.current = []
    remoteUserIdRef.current = null
    pendingOfferRef.current = null
  }, [localStream])

  const endCall = useCallback(() => {
    stopRingtone()
    if (remoteUserIdRef.current) {
      sendSignal(remoteUserIdRef.current, 'call-end', {})
    }
    doCleanup()
    setCallState('idle')
  }, [sendSignal, doCleanup])

  const rejectCall = useCallback(() => {
    stopRingtone()
    if (remoteUserIdRef.current) {
      sendSignal(remoteUserIdRef.current, 'call-reject', {})
    }
    doCleanup()
    setCallState('idle')
  }, [sendSignal, doCleanup])

  const startCall = useCallback(async (targetUser, type = 'voice') => {
    if (callStateRef.current !== 'idle') return

    setCallState('calling')
    setCallType(type)
    setRemoteUser(targetUser)
    remoteUserIdRef.current = targetUser.id

    try {
      const pc = await setupPeerConnection(type)

      // Send invite
      sendSignal(targetUser.id, 'call-invite', {
        callerId: user.id,
        callerProfile: {
          id: profile.id,
          full_name: profile.full_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
        },
        callType: type,
      })

      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Small delay so callee has time to subscribe to channel
      setTimeout(() => {
        sendSignal(targetUser.id, 'call-offer', {
          offer,
          callerId: user.id,
        })
      }, 500)

      // Auto-timeout after 30s
      setTimeout(() => {
        if (callStateRef.current === 'calling') {
          endCall()
        }
      }, 30000)
    } catch (err) {
      console.error('Start call error:', err)
      alert('Gagal memulai panggilan. Pastikan izin kamera/mikrofon diaktifkan.')
      doCleanup()
      setCallState('idle')
    }
  }, [user?.id, profile, setupPeerConnection, sendSignal, endCall, doCleanup])

  const acceptCall = useCallback(async () => {
    if (callStateRef.current !== 'incoming') return
    stopRingtone()

    try {
      await setupPeerConnection(callType)
      
      // CRITICAL: Update state so UI switches from Modal to CallScreen
      setCallState('connected')

      // Process pending offer if exists
      if (pendingOfferRef.current) {
        await handleOffer(pendingOfferRef.current)
        pendingOfferRef.current = null
      }
    } catch (err) {
      console.error('Accept call error:', err)
      alert('Gagal menjawab panggilan. Pastikan izin kamera/mikrofon diaktifkan.')
      rejectCall()
    }
  }, [callType, setupPeerConnection, handleOffer, rejectCall])

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
      setIsMuted(prev => !prev)
    }
  }, [localStream])

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
      setIsCameraOff(prev => !prev)
    }
  }, [localStream])

  // ===================== RENDER =====================
  const value = {
    callState, callType, remoteUser,
    localStream, remoteStream,
    isMuted, isCameraOff, callDuration,
    startCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera,
  }

  return (
    <CallContext.Provider value={value}>
      {children}
      
      {callState === 'incoming' && (
        <IncomingCallModal
          callerProfile={remoteUser}
          callType={callType}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {(callState === 'calling' || callState === 'connected') && (
        <CallScreen 
          callState={callState}
          callType={callType}
          remoteUser={remoteUser}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          callDuration={callDuration}
          endCall={endCall}
          toggleMute={toggleMute}
          toggleCamera={toggleCamera}
        />
      )}
    </CallContext.Provider>
  )
}
