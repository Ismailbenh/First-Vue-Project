<script setup>
import { computed, ref, onMounted } from 'vue'
import Sidebar from '@/components/sidebar.vue'
import profileCotainer from '@/components/profile_requirement/profileCotainer.vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import { useRouter, useRoute } from 'vue-router'
import Breadcrumbs from '@/components/breadcrumbs.vue'

// State management
const router = useRouter()
const route = useRoute()

const breadcrumbs = [
  { label: 'Home', route: { name: 'profilePage' } },
  { label: 'Rooms', route: null }
]

// Data state
const rooms = ref([])
const profileGroups = ref([])

// Form state
const newRoomName = ref('')
const newRoomCapacity = ref('')

// UI state

const isLoadingRooms = ref(false)
const searchQuery = ref('')
const groupAssignmentMode = ref(false)
const selectedGroupIds = ref([])
const selectedRoomIdForGroups = ref('')

// Edit room modal state
const isEditingRoom = ref(false)
const editingRoom = ref(null)
const editRoomName = ref('')
const editRoomCapacity = ref('')

// Statistics
const stats = computed(() => ({
  totalRooms: rooms.value.length,
  totalCapacity: rooms.value.reduce((sum, r) => sum + (r.max_capacity || 0), 0),
  occupiedSpots: rooms.value.reduce((sum, r) => sum + (r.current_count || 0), 0),
  availableSpots: rooms.value.reduce((sum, r) => sum + Math.max(0, (r.max_capacity || 0) - (r.current_count || 0)), 0)
}))

// Filtered rooms based on search
const filteredRooms = computed(() => {
  if (!searchQuery.value) return rooms.value
  
  const search = searchQuery.value.toLowerCase()
  return rooms.value.filter(r => 
    r.name.toLowerCase().includes(search)
  )
})

// API functions
async function loadRooms() {
  try {
    isLoadingRooms.value = true
    
    const response = await fetch('http://localhost:3000/api/rooms')
    if (response.ok) {
      const roomsData = await response.json()
      
      const roomsWithDetails = await Promise.all(
        roomsData.map(async (room) => {
          try {
            const detailResponse = await fetch(`http://localhost:3000/api/rooms/${room.id}`)
            if (detailResponse.ok) {
              return await detailResponse.json()
            }
            return { ...room, members: [], assignedGroups: [] }
          } catch (error) {
            console.error(`Error loading details for room ${room.id}:`, error)
            return { ...room, members: [], assignedGroups: [] }
          }
        })
      )
      
      rooms.value = roomsWithDetails
    }
  } catch (error) {
    console.error('Error loading rooms:', error)
  } finally {
    isLoadingRooms.value = false
  }
}

async function loadProfileGroups() {
  try {
    const response = await fetch('http://localhost:3000/api/groups')
    if (response.ok) {
      const groups = await response.json()
      profileGroups.value = groups.filter(g => g && g.id && g.name)
    }
  } catch (error) {
    console.error('Error loading groups:', error)
  }
}

async function createRoom() {
  if (!newRoomName.value.trim() || !newRoomCapacity.value) {
    alert('Please enter a room name and capacity')
    return
  }

  const capacity = parseInt(newRoomCapacity.value)
  if (isNaN(capacity) || capacity <= 0) {
    alert('Please enter a valid capacity (positive number)')
    return
  }

  try {
    const response = await fetch('http://localhost:3000/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newRoomName.value.trim(),
        max_capacity: capacity
      })
    })

    const result = await response.json()

    if (result.success) {
      newRoomName.value = ''
      newRoomCapacity.value = ''
      isCreatingRoom.value = false
      await loadRooms()
    } else {
      alert(result.message || 'Failed to create room')
    }
  } catch (error) {
    console.error('Error creating room:', error)
    alert('Error creating room. Please try again.')
  }
}

function openEditRoom(room) {
  editingRoom.value = room
  editRoomName.value = room.name
  editRoomCapacity.value = room.max_capacity
  isEditingRoom.value = true
}

async function saveEditedRoom() {
  if (!editRoomName.value.trim() || !editRoomCapacity.value) {
    alert('Please enter a room name and capacity')
    return
  }

  const capacity = parseInt(editRoomCapacity.value)
  if (isNaN(capacity) || capacity <= 0) {
    alert('Please enter a valid capacity (positive number)')
    return
  }

  if (capacity < editingRoom.value.current_count) {
    alert(`Capacity cannot be less than current occupancy (${editingRoom.value.current_count})`)
    return
  }

  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${editingRoom.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: editRoomName.value.trim(),
        max_capacity: capacity
      })
    })

    const result = await response.json()

    if (result.success) {
      alert('Room updated successfully')
      closeEditRoom()
      await loadRooms()
    } else {
      alert(result.message || 'Failed to update room')
    }
  } catch (error) {
    console.error('Error updating room:', error)
    alert('Error updating room. Please try again.')
  }
}

function closeEditRoom() {
  isEditingRoom.value = false
  editingRoom.value = null
  editRoomName.value = ''
  editRoomCapacity.value = ''
}

async function deleteRoom(roomId) {
  if (!confirm('Are you sure you want to delete this room? All members will be unassigned.')) return

  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${roomId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      await loadRooms()
    } else {
      alert(result.message || 'Failed to delete room')
    }
  } catch (error) {
    console.error('Error deleting room:', error)
    alert('Error deleting room. Please try again.')
  }
}

async function removeProfileFromRoom(profileId, roomId) {
  if (!confirm('Are you sure you want to remove this profile from the room?')) return

  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${roomId}/members/${profileId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      await loadRooms()
    } else {
      alert(result.message || 'Failed to remove profile from room')
    }
  } catch (error) {
    console.error('Error removing profile from room:', error)
    alert('Error removing profile from room. Please try again.')
  }
}

function toggleGroupAssignmentMode() {
  groupAssignmentMode.value = !groupAssignmentMode.value
  selectedGroupIds.value = []
  selectedRoomIdForGroups.value = ''
}

function handleGroupSelect(groupId) {
  const index = selectedGroupIds.value.indexOf(groupId)
  if (index > -1) {
    selectedGroupIds.value.splice(index, 1)
  } else {
    selectedGroupIds.value.push(groupId)
  }
}

async function assignGroupsToRoom() {
  if (!selectedRoomIdForGroups.value || selectedGroupIds.value.length === 0) {
    alert('Please select a room and at least one group')
    return
  }

  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${selectedRoomIdForGroups.value}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupIds: selectedGroupIds.value })
    })

    const result = await response.json()

    if (result.success) {
      alert(result.message)
      selectedGroupIds.value = []
      groupAssignmentMode.value = false
      selectedRoomIdForGroups.value = ''
      await loadRooms()
    } else {
      alert(result.message || 'Failed to assign groups to room')
    }
  } catch (error) {
    console.error('Error assigning groups to room:', error)
    alert('Error assigning groups to room. Please try again.')
  }
}

async function removeGroupFromRoom(groupId, roomId) {
  if (!confirm('Are you sure you want to remove this group from the room?')) return

  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${roomId}/groups/${groupId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      await loadRooms()
    } else {
      alert(result.message || 'Failed to remove group from room')
    }
  } catch (error) {
    console.error('Error removing group from room:', error)
    alert('Error removing group from room. Please try again.')
  }
}

function cancelRoomCreation() {
  isCreatingRoom.value = false
  newRoomName.value = ''
  newRoomCapacity.value = ''
}

onMounted(async () => {
  await Promise.all([
    loadRooms(),
    loadProfileGroups()
  ])
})
</script>

<template>
  <div class="app-container">
    <Sidebar />
    
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">Rooms Management</h1>
          <p class="page-subtitle">Manage room assignments and capacity</p>
        </div>
        
      </header>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Rooms</span>
            <svg class="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <div class="stat-value">{{ stats.totalRooms }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Capacity</span>
            <svg class="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="stat-value">{{ stats.totalCapacity }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Occupied / Available</span>
            <svg class="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <div class="stat-value-small">
            <span class="occupied">{{ stats.occupiedSpots }}</span>
            <span class="divider">/</span>
            <span class="available">{{ stats.availableSpots }}</span>
          </div>
        </div>
      </div>

      <transition name="slide-fade">
        <div v-if="isCreatingRoom" class="create-room-card">
          <h2 class="form-title">Create New Room</h2>
          
          <div class="form-section">
            <div class="form-row">
              <div class="form-field">
                <label class="form-label">Room Name *</label>
                <input 
                  v-model="newRoomName" 
                  placeholder="Enter room name" 
                  class="form-input"
                />
              </div>
              <div class="form-field">
                <label class="form-label">Maximum Capacity *</label>
                <input 
                  v-model="newRoomCapacity" 
                  type="number"
                  min="1"
                  placeholder="Enter capacity" 
                  class="form-input"
                />
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button @click="cancelRoomCreation" class="btn-secondary">
              Cancel
            </button>
            <button 
              @click="createRoom" 
              class="btn-primary"
              :disabled="!newRoomName.trim() || !newRoomCapacity"
            >
              Create Room
            </button>
          </div>
        </div>
      </transition>

      <div v-if="profileGroups.length > 0" class="group-assignment-section">
        <button 
          @click="toggleGroupAssignmentMode"
          class="toggle-assignment-btn"
          :class="{ active: groupAssignmentMode }"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          {{ groupAssignmentMode ? 'Cancel Group Assignment' : 'Assign Groups to Room' }}
        </button>

        <transition name="fade">
          <div v-if="groupAssignmentMode" class="assignment-panel">
            <div class="assignment-header">
              <h3>Select groups and assign to a room</h3>
              <div class="room-selector">
                <select v-model="selectedRoomIdForGroups" class="room-select">
                  <option value="">Select a room...</option>
                  <option 
                    v-for="room in rooms" 
                    :key="room.id" 
                    :value="room.id"
                  >
                    {{ room.name }} ({{ room.current_count }}/{{ room.max_capacity }})
                  </option>
                </select>
                <button 
                  v-if="selectedRoomIdForGroups && selectedGroupIds.length > 0"
                  @click="assignGroupsToRoom"
                  class="btn-assign"
                >
                  Assign {{ selectedGroupIds.length }} Group{{ selectedGroupIds.length > 1 ? 's' : '' }}
                </button>
              </div>
            </div>

            <div class="groups-selection-grid">
              <div
                v-for="group in profileGroups"
                :key="group.id"
                class="group-selection-item"
                :class="{ selected: selectedGroupIds.includes(group.id) }"
                @click="handleGroupSelect(group.id)"
              >
                <input 
                  type="checkbox"
                  :checked="selectedGroupIds.includes(group.id)"
                  @click.stop="handleGroupSelect(group.id)"
                  class="group-checkbox"
                />
                <div class="group-selection-info">
                  <span class="group-selection-name">{{ group.name }}</span>
                  <span class="group-selection-count">{{ group.memberCount || 0 }} members</span>
                </div>
                <svg v-if="selectedGroupIds.includes(group.id)" class="check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </transition>
      </div>

      
      

      <div class="rooms-container">
        <div class="rooms-header">
          <h2 class="section-title">All Rooms</h2>
          <p class="section-subtitle">Showing {{ filteredRooms.length }} of {{ rooms.length }} rooms</p>
        </div>

        <div v-if="isLoadingRooms" class="loading-state">
          <div class="spinner"></div>
          <p>Loading rooms...</p>
        </div>

        <div v-else-if="filteredRooms.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <h3>No rooms found</h3>
          <p>{{ searchQuery ? 'Try adjusting your search' : 'Create your first room to get started' }}</p>
        </div>

        <div v-else class="rooms-grid">
          <div v-for="room in filteredRooms" :key="room.id" class="room-card">
            <div class="room-card-header">
              <div class="room-title-section">
                <h3 class="room-name">{{ room.name }}</h3>
                <div class="capacity-info">
                  <span class="capacity-badge" :class="{ 
                    full: room.current_count >= room.max_capacity,
                    high: room.current_count >= room.max_capacity * 0.8 && room.current_count < room.max_capacity
                  }">
                    {{ room.current_count }}/{{ room.max_capacity }}
                  </span>
                  <span class="capacity-text">
                    {{ room.max_capacity - room.current_count }} spots available
                  </span>
                </div>
              </div>
              <div class="room-actions">
                <button @click="openEditRoom(room)" class="action-btn edit-btn" title="Edit room">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button @click="deleteRoom(room.id)" class="action-btn delete-btn" title="Delete room">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="room.assignedGroups && room.assignedGroups.length > 0" class="assigned-groups-section">
              <h4 class="subsection-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Assigned Groups
              </h4>
              <div class="assigned-groups-list">
                <div v-for="group in room.assignedGroups" :key="group.id" class="assigned-group-item">
                  <div class="group-item-info">
                    <span class="group-item-name">{{ group.name }}</span>
                    <span class="group-item-count">{{ group.memberCount }} members</span>
                  </div>
                  <button 
                    @click="removeGroupFromRoom(group.id, room.id)"
                    class="remove-group-btn"
                    title="Remove group from room"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="room.members && room.members.length > 0" class="room-members-section">
              <h4 class="subsection-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                </svg>
                Members
              </h4>
              <div class="room-members-grid">
                <div v-for="member in room.members" :key="member.id" class="room-member-item">
                  <div class="member-item-info">
                    <span class="member-item-name">{{ member.firstName }} {{ member.lastName }}</span>
                    <span class="member-item-age">Age {{ member.age }}</span>
                    <span v-if="member.group_name" class="member-item-group">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                      </svg>
                      {{ member.group_name }}
                    </span>
                  </div>
                  <button 
                    @click="removeProfileFromRoom(member.id, room.id)"
                    class="remove-member-btn"
                    title="Remove member from room"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="empty-room">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p>No members assigned yet</p>
            </div>
          </div>
        </div>
      </div>

      <transition name="modal-fade">
        <div v-if="isEditingRoom" class="modal-overlay" @click.self="closeEditRoom">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title">Edit Room: {{ editingRoom.name }}</h2>
              <button @click="closeEditRoom" class="modal-close-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div class="modal-body">
              <div class="form-section">
                <label class="form-label">Room Name *</label>
                <input v-model="editRoomName" class="form-input" />
              </div>

              <div class="form-section">
                <label class="form-label">Maximum Capacity *</label>
                <input 
                  v-model="editRoomCapacity" 
                  type="number"
                  min="1"
                  class="form-input"
                />
                <p class="hint-text">Current occupancy: {{ editingRoom.current_count }}</p>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="closeEditRoom" class="btn-secondary">
                Cancel
              </button>
              <button @click="saveEditedRoom" class="btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </transition>
    </main>
  </div>
</template>

<style scoped>
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



.create-room-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e293b;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.create-room-btn:hover {
  background: #334155;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

.stat-value-small {
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.occupied {
  color: #ef4444;
}

.divider {
  color: #cbd5e1;
}

.available {
  color: #10b981;
}

/* Create Room Card */
.create-room-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 1.5rem;
}

.form-section {
  margin-bottom: 2rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.5rem;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  transition: all 0.2s;
  font-family: inherit;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.hint-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-family: inherit;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

/* Group Assignment Section */
.group-assignment-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.toggle-assignment-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  color: #334155;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  justify-content: center;
}

.toggle-assignment-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.toggle-assignment-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.assignment-panel {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.assignment-header {
  margin-bottom: 1.5rem;
}

.assignment-header h3 {
  font-size: 1.1rem;
  color: #0f172a;
  margin-bottom: 1rem;
}

.room-selector {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.room-select {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.room-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn-assign {
  padding: 0.75rem 1.5rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-assign:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.groups-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.75rem;
}

.group-selection-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.group-selection-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.group-selection-item.selected {
  background: #eff6ff;
  border-color: #667eea;
}

.group-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: #667eea;
}

.group-selection-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.group-selection-name {
  font-size: 0.9rem;
  color: #0f172a;
  font-weight: 500;
}

.group-selection-count {
  font-size: 0.8rem;
  color: #64748b;
}

.check-icon {
  color: #667eea;
}

/* Search Section */
.search-section {
  margin-bottom: 2rem;
}

.search-bar {
  position: relative;
  max-width: 600px;
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
  background: white;
  transition: all 0.2s;
  font-family: inherit;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Rooms Container */
.rooms-container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.rooms-header {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.section-subtitle {
  font-size: 0.875rem;
  color: #64748b;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-state svg {
  color: #cbd5e1;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  color: #334155;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #64748b;
  font-size: 0.95rem;
}

/* Rooms Grid */
.rooms-grid {
  display: grid;
  gap: 1.5rem;
}

.room-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  background: #fafbfc;
  transition: all 0.2s;
}

.room-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #cbd5e1;
}

.room-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.room-title-section {
  flex: 1;
}

.room-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.75rem;
}

.capacity-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.capacity-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  background: #10b981;
  color: white;
}

.capacity-badge.high {
  background: #f59e0b;
}

.capacity-badge.full {
  background: #ef4444;
}

.capacity-text {
  font-size: 0.875rem;
  color: #64748b;
}

.room-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
}

.edit-btn {
  color: #3b82f6;
}

.edit-btn:hover {
  background: #eff6ff;
}

.delete-btn {
  color: #ef4444;
}

.delete-btn:hover {
  background: #fef2f2;
}

/* Assigned Groups Section */
.assigned-groups-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #fef3c7;
  border-radius: 8px;
  border-left: 4px solid #f59e0b;
}

.subsection-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #78350f;
  margin-bottom: 0.75rem;
}

.assigned-groups-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.assigned-group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #fde68a;
}

.group-item-info {
  display: flex;
  flex-direction: column;
}

.group-item-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f172a;
}

.group-item-count {
  font-size: 0.8rem;
  color: #64748b;
}

.remove-group-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: #ef4444;
}

.remove-group-btn:hover {
  background: #fef2f2;
}

/* Room Members Section */
.room-members-section {
  margin-bottom: 1rem;
}

.room-members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.75rem;
}

.room-member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.room-member-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.member-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.member-item-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #0f172a;
}

.member-item-age {
  font-size: 0.8rem;
  color: #64748b;
}

.member-item-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #667eea;
  font-style: italic;
}

.remove-member-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: #ef4444;
}

.remove-member-btn:hover {
  background: #fef2f2;
}

.empty-room {
  text-align: center;
  padding: 3rem 2rem;
  color: #94a3b8;
}

.empty-room svg {
  color: #cbd5e1;
  margin-bottom: 0.75rem;
}

.empty-room p {
  font-style: italic;
  font-size: 0.9rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #0f172a;
}

.modal-close-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.modal-close-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

.modal-body {
  padding: 2rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 2rem;
  border-top: 1px solid #e2e8f0;
}

/* Animations */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    padding: 1.5rem;
  }

  .page-header {
    flex-direction: column;
    gap: 1rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .room-card-header {
    flex-direction: column;
    gap: 1rem;
  }

  .room-members-grid {
    grid-template-columns: 1fr;
  }

  .groups-selection-grid {
    grid-template-columns: 1fr;
  }

  .modal-content {
    max-width: 95%;
  }
}
</style>