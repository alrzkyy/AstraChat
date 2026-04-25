/**
 * WebRTC configuration and utilities
 */

// Free STUN servers for NAT traversal
export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
}

/**
 * Create a new RTCPeerConnection with ICE servers
 */
export function createPeerConnection() {
  return new RTCPeerConnection(ICE_SERVERS)
}

/**
 * Get user media (camera/microphone)
 */
export async function getUserMedia(video = true, audio = true) {
  try {
    const constraints = {
      audio: audio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } : false,
      video: video ? {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: 'user',
      } : false,
    }
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch (err) {
    console.error('getUserMedia error:', err)
    throw err
  }
}

/**
 * Stop all tracks of a media stream
 */
export function stopStream(stream) {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop()
    })
  }
}
