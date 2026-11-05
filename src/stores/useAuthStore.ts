import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../lib/types'

export interface AuthState {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setIsLoading: (isLoading: boolean) => void
  login: (email: string, pass: string) => Promise<void>
  logout: () => Promise<void>
  fetchProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setIsLoading: (isLoading) => set({ isLoading }),
      login: async (email, pass) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        })
        if (error) throw error
      },
      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null, profile: null })
      },
      fetchProfile: async () => {
        const user = get().user
        if (!user) {
          set({ profile: null })
          return
        }
        const { data, error } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (error) {
          console.error('Error fetching profile:', error.message)
          set({ profile: null })
          return
        }
        if (data) {
          set({ profile: data as Profile })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profile: state.profile }),
    }
  )
)
