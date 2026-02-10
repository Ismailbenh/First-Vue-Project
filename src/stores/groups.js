import { defineStore } from 'pinia'

export const useGroupsStore = defineStore('groups', {
  state: () => ({
    list: [],
    loading: false,
    error: null
  }),
  actions: {
    async fetchAll(force = false) {
      if (this.loading) return
      if (this.list.length > 0 && !force) return this.list
      this.loading = true
      try {
        const res = await fetch('http://localhost:3000/api/groups')
        if (!res.ok) throw new Error('Failed to load groups')
        const groups = await res.json()
        // Optionally expand members by fetching detail, but avoid N+1 here
        this.list = groups
        this.error = null
        return this.list
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },
    async create(payload) {
      const res = await fetch('http://localhost:3000/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Create group failed')
      await this.fetchAll(true)
      return data
    }
  }
})