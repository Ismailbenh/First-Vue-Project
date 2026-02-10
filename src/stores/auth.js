import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,       // if backend returns token
    loading: false,
    error: null
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    userRole: (state) => state.user?.role || null
  },
  actions: {
    async login(email, password) {
      this.loading = true
      this.error = null
      try {
        const res = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Login failed')
        this.user = data.user
        this.token = data.token || null
        return data
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },
    logout() {
      this.user = null
      this.token = null
      this.error = null
    },
    setUser(user) {
      this.user = user
    }
  }
})