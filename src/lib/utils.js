/**
 * Mask phone number: 0812****7890
 */
export function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone || ''
  return phone.slice(0, 4) + '****' + phone.slice(-4)
}

/**
 * Format date to relative or absolute string
 */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format time for chat messages
 */
export function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * Get default avatar URL
 */
export function getAvatarUrl(avatarUrl, name) {
  if (avatarUrl) return avatarUrl
  const initial = (name || '?').charAt(0).toUpperCase()
  return `https://ui-avatars.com/api/?name=${initial}&background=7c3aed&color=fff&bold=true&size=128`
}

/**
 * Validate Indonesian phone number
 */
export function isValidIndonesianPhone(phone) {
  const cleaned = phone.replace(/\D/g, '')
  return /^(08|628)\d{8,12}$/.test(cleaned)
}

/**
 * Normalize phone number to 08xxx format
 */
export function normalizePhone(phone) {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('628')) {
    cleaned = '0' + cleaned.slice(2)
  }
  if (cleaned.startsWith('+628')) {
    cleaned = '0' + cleaned.slice(3)
  }
  return cleaned
}

/**
 * Generate random invite code
 */
export function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * Truncate text
 */
export function truncate(str, len = 50) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}

/**
 * Note categories
 */
export const NOTE_CATEGORIES = [
  'Matematika',
  'Biologi',
  'Fisika',
  'Kimia',
  'Sejarah',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Lainnya',
]

/**
 * File validation constants
 */
export const FILE_LIMITS = {
  avatar: { maxSize: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  note: { maxSize: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  chat: { 
    maxSize: 50 * 1024 * 1024, // 50MB for chat to allow videos
    typePrefixes: ['image/', 'video/', 'audio/'],
    types: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'text/plain'] 
  },
}

/**
 * Validate file
 */
export function validateFile(file, type = 'chat') {
  const limits = FILE_LIMITS[type]
  if (!limits) return { valid: false, error: 'Tipe tidak valid' }
  if (file.size > limits.maxSize) {
    return { valid: false, error: `File terlalu besar. Maks ${formatFileSize(limits.maxSize)}` }
  }
  
  if (limits.typePrefixes) {
    const hasValidPrefix = limits.typePrefixes.some(prefix => file.type.startsWith(prefix))
    if (hasValidPrefix) return { valid: true, error: null }
  }
  
  if (limits.types && !limits.types.includes(file.type)) {
    return { valid: false, error: 'Tipe file tidak didukung' }
  }
  return { valid: true, error: null }
}
