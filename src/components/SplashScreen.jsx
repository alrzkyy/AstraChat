import React from 'react'

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-dark-950 flex flex-col items-center justify-center z-[100] fade-in">
      <div className="relative flex flex-col items-center">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl overflow-hidden mb-6 relative animate-bounce">
          <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full"></div>
          <img src="/logo.png" alt="AstraChat Logo" className="w-full h-full object-cover relative z-10 drop-shadow-xl" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-widest mb-4 drop-shadow-lg">
          Astra<span className="text-primary-400">Chat</span>
        </h1>
        
        <div className="flex items-center gap-2 mt-4">
          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        
        <p className="absolute bottom-10 text-dark-500 text-sm tracking-widest uppercase">
          End-to-End Encrypted
        </p>
      </div>
    </div>
  )
}
