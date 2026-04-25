import { useRef, useState } from 'react'
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react'
import { validateFile, formatFileSize } from '../lib/utils'

export default function FileUpload({ onFileSelect, type = 'chat', accept, className = '' }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    const validation = validateFile(file, type)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setPreview({ url: ev.target.result, name: file.name, size: file.size, isImage: true })
      reader.readAsDataURL(file)
    } else {
      setPreview({ url: null, name: file.name, size: file.size, isImage: false })
    }

    onFileSelect(file)
  }

  const clearFile = () => {
    setPreview(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
    onFileSelect(null)
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        onChange={handleChange}
        accept={accept}
        className="hidden"
      />

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 text-dark-400 hover:text-primary-400 transition-colors"
          title="Upload file"
        >
          <Upload className="w-5 h-5" />
        </button>
      ) : (
        <div className="flex items-center gap-2 p-2 bg-dark-800 rounded-lg">
          {preview.isImage ? (
            <img src={preview.url} alt="" className="w-10 h-10 rounded object-cover" />
          ) : (
            <FileText className="w-10 h-10 text-primary-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white truncate">{preview.name}</p>
            <p className="text-xs text-dark-400">{formatFileSize(preview.size)}</p>
          </div>
          <button onClick={clearFile} className="text-dark-400 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
