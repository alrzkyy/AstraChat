import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Cari...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
