import { Loader2 } from 'lucide-react'

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
  xl: 'w-16 h-16',
}

export default function LoadingSpinner({ size = 'md', text = '', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className={`${sizes[size]} text-primary-500 animate-spin`} />
      {text && <p className="text-dark-400 text-sm">{text}</p>}
    </div>
  )
}
