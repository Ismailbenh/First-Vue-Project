import { defineStore } from 'pinia'

export const useProfilesStore = defineStore('profiles', {
  state: () => ({
    list: [],
    loading: false,
    lastUpdated: null,
    error: null
  }),
  getters: {
    byId: (state) => (id) => state.list.find(p => p.id === id)
  },
  actions: {
    async fetchAll(force = false) {
      if (this.loading) return
      if (this.list.length > 0 && !force) return this.list
      this.loading = true
      try {
        const res = await fetch('http://localhost:3000/api/profiles')
        if (!res.ok) throw new Error('Failed to load profiles')
        this.list = await res.json()
        this.lastUpdated = Date.now()
        this.error = null
        return this.list
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },
    addLocal(profile) {
      this.list.unshift(profile)
    },
    removeLocal(id) {
      this.list = this.list.filter(p => p.id !== id)
    }
  }
})