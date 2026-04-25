import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
  onlineUsers: new Set(),
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [minSplashDone, setMinSplashDone] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  useEffect(() => {
    // Guaranteed minimum 2.5s splash screen on every hard refresh
    const timer = setTimeout(() => {
      setMinSplashDone(true)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
      return data
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          // Small delay to allow trigger to create profile
          if (event === 'SIGNED_IN') {
            setTimeout(() => fetchProfile(session.user.id), 500)
          } else {
            await fetchProfile(session.user.id)
          }
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Realtime profile updates and Presence
  useEffect(() => {
    if (!user?.id) {
      setOnlineUsers(new Set())
      return
    }

    // 1. Listen for own profile updates
    const profileChannel = supabase
      .channel(`public:profiles:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        setProfile(payload.new)
      })
      .subscribe()

    // 2. Global presence tracking
    const presenceChannel = supabase.channel('global-presence')
    
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      const onlineIds = new Set()
      for (const key in state) {
        state[key].forEach(p => {
          if (p.user_id) onlineIds.add(p.user_id)
        })
      }
      setOnlineUsers(onlineIds)
    })

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ user_id: user.id })
      }
    })

    return () => {
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(presenceChannel)
    }
  }, [user?.id])

  const signUp = async ({ email, password, fullName, username, phone }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username,
        },
      },
    })

    if (error) throw error

    // Update profile with phone number after creation
    if (data.user) {
      // Wait for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          phone_number: phone || '',
          full_name: fullName,
          username: username,
        })
        .eq('id', data.user.id)

      if (profileError) console.error('Profile update error:', profileError)
    }

    return data
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading: loading || !minSplashDone, 
      onlineUsers, 
      signUp, 
      signIn, 
      signOut, 
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  )
}
