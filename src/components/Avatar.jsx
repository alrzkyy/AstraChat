import { getAvatarUrl } from '../lib/utils'

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl',
}

export default function Avatar({ src, name = '', size = 'md', online = false, className = '' }) {
  const url = getAvatarUrl(src, name)

  return (
    <div className={`relative inline-flex shrink-0 rounded-full ${sizes[size]} ${className}`}>
      <img
        src={url}
        alt={name || 'Avatar'}
        className="w-full h-full rounded-full object-cover ring-2 ring-dark-700 bg-dark-700"
        onError={(e) => {
          e.target.src = getAvatarUrl(null, name)
        }}
      />
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-dark-900 pulse-dot" />
      )}
    </div>
  )
}
