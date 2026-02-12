<script setup>
import { computed, ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import CustomButton from '@/components/profile_requirement/button.vue'
import { useRouter, useRoute } from 'vue-router'
import Sidebar from '@/components/sidebar.vue'

// State management
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// Filter and search state
const searchQuery = ref('')
const selectedGroup = ref('All Groups')
const selectedRoom = ref('All Rooms')
const showAdvancedFilters = ref(false)

// Data state
const profiles = ref([])
const profileGroups = ref([])
const rooms = ref([])
const stats = ref({
  totalProfiles: 0,
  activeGroups: 0,
  availableRooms: 0
})

// Computed properties
const filteredProfiles = computed(() => {
  let filtered = [...profiles.value]
  
  // Search filter
  if (searchQuery.value) {
    const search = searchQuery.value.toLowerCase()
    filtered = filtered.filter(p => 
      p.firstName.toLowerCase().includes(search) ||
      p.lastName.toLowerCase().includes(search) ||
      (p.professions && p.professions.some(prof => 
        (prof.name || prof).toLowerCase().includes(search)
      ))
    )
  }
  
  // Group filter
  if (selectedGroup.value !== 'All Groups') {
    filtered = filtered.filter(p => p.group_name === selectedGroup.value)
  }
  
  // Room filter
  if (selectedRoom.value !== 'All Rooms') {
    filtered = filtered.filter(p => p.room_name === selectedRoom.value)
  }
  
  return filtered
})

const groupOptions = computed(() => {
  const groups = new Set(['All Groups'])
  profiles.value.forEach(p => {
    if (p.group_name) groups.add(p.group_name)
  })
  return Array.from(groups)
})

const roomOptions = computed(() => {
  const roomSet = new Set(['All Rooms'])
  profiles.value.forEach(p => {
    if (p.room_name) roomSet.add(p.room_name)
  })
  return Array.from(roomSet)
})

// API functions
async function loadProfiles() {
  try {
    const response = await fetch('http://localhost:3000/api/profiles')
    if (response.ok) {
      profiles.value = await response.json()
      updateStats()
    }
  } catch (error) {
    console.error('Error loading profiles:', error)
  }
}

async function loadProfileGroups() {
  try {
    const response = await fetch('http://localhost:3000/api/groups')
    if (response.ok) {
      profileGroups.value = await response.json()
      updateStats()
    }
  } catch (error) {
    console.error('Error loading groups:', error)
  }
}

async function loadRooms() {
  try {
    const response = await fetch('http://localhost:3000/api/rooms')
    if (response.ok) {
      rooms.value = await response.json()
      updateStats()
    }
  } catch (error) {
    console.error('Error loading rooms:', error)
  }
}

function updateStats() {
  stats.value = {
    totalProfiles: profiles.value.length,
    activeGroups: profileGroups.value.filter(g => g && g.memberCount > 0).length,
    availableRooms: rooms.value.filter(r => r.current_count < r.max_capacity).length
  }
}

function editProfile(id) {
  router.push({ name: 'infoPage', params: { id } })
}

async function deleteProfile(id) {
  if (!confirm('Are you sure you want to delete this profile?')) return
  
  try {
    const response = await fetch(`http://localhost:3000/api/profiles/${id}`, {
      method: 'DELETE',
    })
    
    if (response.ok) {
      await loadProfiles()
      await loadProfileGroups()
      await loadRooms()
    }
  } catch (error) {
    console.error('Error deleting profile:', error)
  }
}

const handleLogout = () => {
  try {
    auth.logout()
  } catch (e) {
    // ignore
  }
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('userEmail')
  localStorage.removeItem('userRole')
  localStorage.removeItem('userId')
  router.push('/login')
}

onMounted(async () => {
  await Promise.all([
    loadProfiles(),
    loadProfileGroups(),
    loadRooms()
  ])
})
</script>

<template>
    
  <div class="app-container">
    
    <Sidebar />
    
    <main class="main-content">
      
      
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">ProfileHub</h1>
          <p class="page-subtitle">Manage user profiles, groups, and room assignments</p>
        </div>
        <button @click="handleLogout" class="app-badge" title="Close">
        logout
        </button>
        
      </header>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Profiles</span>
            
          </div>
          <div class="stat-value">{{ stats.totalProfiles }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Active Groups</span>
            
          </div>
          <div class="stat-value">{{ stats.activeGroups }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Available Rooms</span>
            
          </div>
          <div class="stat-value">{{ stats.availableRooms }}</div>
        </div>
      </div>
      
      <div class="search-section">
        <div class="search-bar">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search by name, profession, or age..."
            class="search-input"
          />
        </div>
        
        <div class="filter-controls">
          <button 
            class="filter-button" 
            @click="showAdvancedFilters = !showAdvancedFilters"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </button>
          
          <select v-model="selectedGroup" class="filter-select">
            <option v-for="group in groupOptions" :key="group" :value="group">
              {{ group }}
            </option>
          </select>
          
          <select v-model="selectedRoom" class="filter-select">
            <option v-for="room in roomOptions" :key="room" :value="room">
              {{ room }}
            </option>
          </select>
        </div>
      </div>
      
      <div class="table-container">
        <div class="table-header">
          <h2 class="table-title">All Profiles</h2>
          <p class="table-subtitle">Showing {{ filteredProfiles.length }} of {{ profiles.length }} profiles</p>
        </div>
        
        <div class="table-wrapper">
          <table class="profiles-table">
            <thead>
              <tr>
                <th class="th-name">Name</th>
                <th class="th-profession">Profession</th>
                <th class="th-age">Age</th>
                <th class="th-group">Group</th>
                <th class="th-room">Room</th>
                <th class="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="profile in filteredProfiles" :key="profile.id" class="table-row">
                <td class="td-name">{{ profile.firstName }} {{ profile.lastName }}</td>
                <td class="td-profession">
                  <span v-if="profile.professions && profile.professions.length > 0">
                    {{ profile.professions.map(p => p.name || p).join(', ') }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td class="td-age">{{ profile.age }}</td>
                <td class="td-group">
                  <span v-if="profile.group_name" class="badge badge-group">
                    {{ profile.group_name }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td class="td-room">
                  <span v-if="profile.room_name" class="badge badge-room">
                    {{ profile.room_name }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td class="td-actions">
                  <button @click="editProfile(profile.id)" class="action-btn action-edit">
                    Edit
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Import a modern font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.main-content {
  flex: 1;
  margin-left: 70px;
  padding: 2rem 3rem;
  position: relative;
}

/* Close Button */
.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 2rem;
  background: transparent;
  border: none;
  font-size: 0.95rem;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.2s;
  font-weight: 500;
}

.close-btn:hover {
  color: #334155;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.header-content {
  flex: 1;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 1rem;
  color: #64748b;
  font-weight: 400;
}



.app-badge {
  background: #1e293b;
  color: white;
  padding: 0.4rem 0.9rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
  text-transform: capitalize;
}

.stat-icon {
  color: #cbd5e1;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

/* Search Section */
.search-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.search-bar {
  position: relative;
  margin-bottom: 1rem;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 3rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  transition: all 0.2s;
  font-family: inherit;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: #cbd5e1;
}

/* Filter Controls */
.filter-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.filter-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.filter-button:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.filter-select {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #0f172a;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-weight: 500;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Table Container */
.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.table-header {
  padding: 1.75rem 2rem;
  border-bottom: 1px solid #e2e8f0;
}

.table-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.table-subtitle {
  font-size: 0.875rem;
  color: #64748b;
}

/* Table */
.table-wrapper {
  overflow-x: auto;
}

.profiles-table {
  width: 100%;
  border-collapse: collapse;
}

.profiles-table thead {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.profiles-table th {
  padding: 1rem 1.5rem;
  text-align: left;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profiles-table tbody tr {
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s;
}

.profiles-table tbody tr:last-child {
  border-bottom: none;
}

.profiles-table tbody tr:hover {
  background: #f8fafc;
}

.profiles-table td {
  padding: 1.25rem 1.5rem;
  font-size: 0.9rem;
  color: #334155;
}

.td-name {
  font-weight: 500;
  color: #0f172a;
}

.text-muted {
  color: #94a3b8;
  font-style: italic;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.badge-group {
  background: #dbeafe;
  color: #1e40af;
}

.badge-room {
  background: #e0e7ff;
  color: #5b21b6;
}

/* Action Button */
.td-actions {
  text-align: right;
}

.action-btn {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-family: inherit;
}

.action-edit {
  background: transparent;
  color: #3b82f6;
  border: 1px solid transparent;
}

.action-edit:hover {
  background: #eff6ff;
  color: #2563eb;
}

/* Responsive */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    padding: 1.5rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .filter-controls {
    flex-direction: column;
  }
  
  .filter-select {
    width: 100%;
  }
  
  .table-wrapper {
    overflow-x: scroll;
  }
}
</style>