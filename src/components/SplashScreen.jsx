import React, { useState, useEffect } from 'react'

export default function SplashScreen() {
  const [text, setText] = useState('')
  const fullText = 'AstraChat'

  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      setText(fullText.slice(0, i + 1))
      i++
      if (i >= fullText.length) {
        clearInterval(timer)
      }
    }, 150)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="fixed inset-0 bg-dark-950 flex flex-col items-center justify-center z-[100] fade-in">
      <div className="flex flex-col items-center">
        {/* Static Logo */}
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden mb-6 relative">
          <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full"></div>
          <img src="/logo.png" alt="AstraChat Logo" className="w-full h-full object-cover relative z-10 drop-shadow-xl" />
        </div>
        
        {/* Typewriter Text */}
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-widest mb-4 drop-shadow-lg h-10 flex items-center">
          {text}<span className="animate-pulse">_</span>
        </h1>
        
        {/* Loading Dots */}
        <div className="flex items-center gap-2 mt-4">
          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
      
      {/* Bottom Text (moved outside flex container to ensure bottom placement) */}
      <p className="absolute bottom-10 text-dark-500 text-sm tracking-widest uppercase text-center w-full">
        End-to-End Encrypted
      </p>
    </div>
  )
}
