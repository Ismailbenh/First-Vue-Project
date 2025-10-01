// stores/auth.js
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isLoading: false
  }),

  getters: {
    isAuthenticated: (state) => !!state.token
  },

  actions: {
    async login(email, password) {
      this.isLoading = true
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password })
        })

        const data = await response.json()

        if (data.success) {
          this.token = data.token
          this.user = { email }
          
          // Store in localStorage for persistence
          localStorage.setItem('authToken', data.token)
          localStorage.setItem('userEmail', email)
          
          return { success: true }
        } else {
          return { 
            success: false, 
            error: data.message || 'Login failed' 
          }
        }
      } catch (error) {
        console.error('Login error:', error)
        return { 
          success: false, 
          error: 'Network error. Please try again.' 
        }
      } finally {
        this.isLoading = false
      }
    },

    logout() {
      this.user = null
      this.token = null
      
      // Clear localStorage
      localStorage.removeItem('authToken')
      localStorage.removeItem('userEmail')
    },

    initializeAuth() {
      // Check if user was previously logged in
      const token = localStorage.getItem('authToken')
      const email = localStorage.getItem('userEmail')
      
      if (token && email) {
        this.token = token
        this.user = { email }
      }
    }
  }
})