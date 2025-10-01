<script setup>
import { computed, ref, onMounted } from 'vue'
import Sidebar from '@/components/sidebar.vue'
import profileCotainer from '@/components/profile_requirement/profileCotainer.vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import AddIcon from '@/components/icons/addIcon.vue'
import { useRouter, useRoute } from 'vue-router'
import profilesData from '@/data/profiles.json'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import selectionIcon from '@/components/icons/selectionIcon.vue'

const breadcrumbs = [
  { label: 'Home', route: { name: 'profilePage' } },
  { label: 'Rooms', route: null }
]

const profiles = ref(profilesData)
const router = useRouter()
const route = useRoute()
const filterText = ref("")
const filteredProfiles = ref([])
const showFiltered = ref(false)
const selectedProfiles = ref([])
const profileGroups = ref([])
const newGroupName = ref('')
const newGroupDescription = ref('')
const isCreatingGroup = ref(false)
const selectionMode = ref(false)
const isLoadingGroups = ref(false)
const rooms = ref([])
const availableProfiles = ref([])
const isLoadingRooms = ref(false)
const roomSelectionMode = ref(false)
const selectedRoomId = ref('')
const isEditing = ref(false)
const profile = ref({})
const groupAssignmentMode = ref(false)
const selectedGroupIds = ref([])
const selectedRoomIdForGroups = ref('')

const id = computed(() => route.params.id)

const displayProfiles = computed(() => {
  if (showFiltered.value && filteredProfiles.value.length > 0) {
    return filteredProfiles.value
  }
  return profiles.value || []
})

const profilesWithMessages = computed(() => {
  const profilesToShow = displayProfiles.value
  return profilesToShow.filter(profile => profile.message && profile.message.trim() !== '')
})

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    selectedProfiles.value = []
  }
}

function handleProfileSelect(profileId) {
  const index = selectedProfiles.value.indexOf(profileId)
  if (index > -1) {
    selectedProfiles.value.splice(index, 1)
  } else {
    selectedProfiles.value.push(profileId)
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
    console.log('Assigning groups:', selectedGroupIds.value, 'to room:', selectedRoomIdForGroups.value)
    
    const response = await fetch(`http://localhost:3000/api/rooms/${selectedRoomIdForGroups.value}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupIds: selectedGroupIds.value })
    })

    const result = await response.json()
    console.log('Assignment response:', result)

    if (result.success) {
      alert(`✅ ${result.message}`)
      
      // Reset selection
      selectedGroupIds.value = []
      groupAssignmentMode.value = false
      selectedRoomIdForGroups.value = ''
      
      // Refresh all data
      await Promise.all([
        loadRooms(),
        loadAvailableProfiles(),
        loadProfiles(),
        loadProfileGroups()
      ])
    } else {
      console.error('Assignment failed:', result.message)
      alert(`❌ ${result.message}`)
    }
  } catch (error) {
    console.error('Network error assigning groups to room:', error)
    alert('❌ Network error. Please check if the server is running and try again.')
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
      console.log('✅ Group removed from room successfully')
      await Promise.all([
        loadRooms(),
        loadAvailableProfiles(),
        loadProfiles(),
        loadProfileGroups()
      ])
    } else {
      alert(result.message || 'Failed to remove group from room')
    }
  } catch (error) {
    console.error('Error removing group from room:', error)
    alert('Error removing group from room. Please try again.')
  }
}

async function createProfileGroup() {
  if (!newGroupName.value.trim() || selectedProfiles.value.length === 0) {
    alert('Please enter a group name and select at least one profile')
    return
  }

  try {
    const response = await fetch('http://localhost:3000/api/groups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newGroupName.value.trim(),
        description: newGroupDescription.value.trim(),
        profileIds: selectedProfiles.value
      })
    })

    const result = await response.json()

    if (result.success) {
      console.log(`✅ Created group "${result.group.name}" with ${result.group.memberCount} profiles`)
      
      // Reset form
      newGroupName.value = ''
      newGroupDescription.value = ''
      selectedProfiles.value = []
      isCreatingGroup.value = false
      selectionMode.value = false
      
      // Refresh groups list
      await loadProfileGroups()
      
    } else {
      alert(result.message || 'Failed to create group')
    }
  } catch (error) {
    console.error('Error creating group:', error)
    alert('Error creating group. Please try again.')
  }
}

async function loadRooms() {
  try {
    isLoadingRooms.value = true
    console.log('Loading rooms from database...')
    
    const response = await fetch('http://localhost:3000/api/rooms')
    if (response.ok) {
      const roomsData = await response.json()
      
      // For each room, fetch detailed member information
      const roomsWithMembers = await Promise.all(
        roomsData.map(async (room) => {
          try {
            const detailResponse = await fetch(`http://localhost:3000/api/rooms/${room.id}`)
            if (detailResponse.ok) {
              return await detailResponse.json()
            }
            return { ...room, members: [], assignedGroups: [] }
          } catch (error) {
            console.error(`Error loading members for room ${room.id}:`, error)
            return { ...room, members: [], assignedGroups: [] }
          }
        })
      )
      
      rooms.value = roomsWithMembers
      console.log(`Loaded ${roomsData.length} rooms`)
    } else {
      console.error('Failed to fetch rooms')
    }
  } catch (error) {
    console.error('Error loading rooms:', error)
  } finally {
    isLoadingRooms.value = false
  }
}

async function loadAvailableProfiles() {
  try {
    const response = await fetch('http://localhost:3000/api/profiles/available')
    if (response.ok) {
      const profiles = await response.json()
      availableProfiles.value = profiles
      console.log(`Loaded ${profiles.length} available profiles`)
    }
  } catch (error) {
    console.error('Error loading available profiles:', error)
  }
}

function toggleRoomSelectionMode() {
  roomSelectionMode.value = !roomSelectionMode.value
  selectedRoomId.value = ''
  if (roomSelectionMode.value) {
    loadAvailableProfiles()
  } else {
    selectedProfiles.value = []
  }
}

async function addProfileToRoom(profileId, roomId) {
  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${roomId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profileId })
    })

    const result = await response.json()

    if (result.success) {
      console.log(`✅ Added profile to room`)
      await Promise.all([
        loadRooms(),
        loadAvailableProfiles(),
        loadProfiles()
      ])
    } else {
      alert(result.message || 'Failed to add profile to room')
    }
  } catch (error) {
    console.error('Error adding profile to room:', error)
    alert('Error adding profile to room. Please try again.')
  }
}

async function addSelectedProfilesToRoom() {
  if (!selectedRoomId.value || selectedProfiles.value.length === 0) {
    alert('Please select a room and at least one profile')
    return
  }

  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${selectedRoomId.value}/members/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profileIds: selectedProfiles.value })
    })

    const result = await response.json()

    if (result.success) {
      alert(`${result.message}${result.skippedCount > 0 ? ` (${result.skippedCount} profiles were already assigned)` : ''}`)
      
      // Reset selection
      selectedProfiles.value = []
      roomSelectionMode.value = false
      selectedRoomId.value = ''
      
      // Refresh data
      await Promise.all([
        loadRooms(),
        loadAvailableProfiles(),
        loadProfiles()
      ])
    } else {
      alert(result.message || 'Failed to add profiles to room')
    }
  } catch (error) {
    console.error('Error adding profiles to room:', error)
    alert('Error adding profiles to room. Please try again.')
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
      let message = '✅ Profile removed from room successfully'
      if (result.groupRemoved) {
        message += '\n🗑️ Empty group was also removed from the room'
      }
      console.log(message)
      
      // Refresh all data to show updated counts
      await Promise.all([
        loadRooms(),
        loadAvailableProfiles(),
        loadProfiles(),
        loadProfileGroups()
      ])
    } else {
      alert(`❌ ${result.message}`)
    }
  } catch (error) {
    console.error('Error removing profile from room:', error)
    alert('❌ Network error. Please try again.')
  }
}

async function deleteProfileGroup(groupId) {
  if (!confirm('Are you sure you want to delete this group?')) return

  try {
    const response = await fetch(`http://localhost:3000/api/groups/${groupId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      console.log('✅ Group deleted successfully')
      await loadProfileGroups()
    } else {
      alert(result.message || 'Failed to delete group')
    }
  } catch (error) {
    console.error('Error deleting group:', error)
    alert('Error deleting group. Please try again.')
  }
}

async function loadProfileGroups() {
  try {
    isLoadingGroups.value = true
    console.log('Loading profile groups from database...')
    
    const response = await fetch('http://localhost:3000/api/groups')
    if (response.ok) {
      const groups = await response.json()
      
      // DON'T fetch individual group details - use the data directly from the list
      profileGroups.value = groups.filter(g => g && g.id && g.name)
      console.log(`Loaded ${profileGroups.value.length} valid groups`)
    } else {
      console.error('Failed to fetch groups')
    }
  } catch (error) {
    console.error('Error loading groups:', error)
  } finally {
    isLoadingGroups.value = false
  }
}

function handleAddButton() {
  router.push({ name: 'infoPage' })
}

function editProfile(id) {
  console.log('Editing profile with id:', id)
  router.push({ name: 'infoPage', params: { id } })
}

async function deleteProfile(id) {
  try {
    const response = await fetch(`http://localhost:3000/api/profiles/${id}`, {
      method: 'DELETE',
    })

    const result = await response.json()

    if (result.success) {
      profiles.value = profiles.value.filter(p => p.id !== id)
      await Promise.all([
        loadProfileGroups(),
        loadRooms()
      ])
    } else {
      console.error(result.message || 'Failed to delete profile')
    }
  } catch (error) {
    console.error('Error deleting profile:', error)
  }
}

async function loadProfiles() {
  try {
    console.log('Fetching all profiles...')
    const response = await fetch('http://localhost:3000/api/profiles')
    if (response.ok) {
      const apiProfiles = await response.json()
      profiles.value = apiProfiles
      console.log(`Loaded ${apiProfiles.length} profiles`)
    } else {
      console.error('Failed to fetch profiles')
    }
  } catch (error) {
    console.error('Error fetching profiles list:', error)
  }
}

function handleFilterButton() {
  console.log('Filter applied:', filterText.value)
  if (!filterText.value) {
    showFiltered.value = false
    filteredProfiles.value = []
    return
  }
  
  const search = filterText.value.toLowerCase().trim()
  filteredProfiles.value = profiles.value.filter(p => {
    return (
      p.firstName.toLowerCase().includes(search) ||
      p.fullName.toLowerCase().includes(search)
    )
  })
  showFiltered.value = true
}

const assignToRooms = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/assignRooms', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      alert(`${data.message}${data.unassignedRemaining > 0 ? ` (${data.unassignedRemaining} profiles couldn't be assigned due to room capacity)` : ''}`)
      await Promise.all([
        loadRooms(),
        loadAvailableProfiles(),
        loadProfiles()
      ])
    } else {
      alert(data.message || 'Assignment failed.')
    }
  } catch (error) {
    console.error(error)
    alert('Server error during assignment.')
  }
}

onMounted(async () => {
  if (id.value) {
    isEditing.value = true
    try {
      console.log('Fetching profile with ID:', id.value)
      const response = await fetch(`http://localhost:3000/api/profiles/${id.value}`)
      if (response.ok) {
        const existing = await response.json()
        profile.value = existing
        console.log('Profile loaded:', existing)
      } else {
        console.error('Profile not found, redirecting...')
        alert('Profile not found!')
        router.push({ name: 'profilePage' })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      alert('Error loading profile!')
    }
  }
  
  // Load all data in parallel
  await Promise.all([
    loadProfiles(),
    loadProfileGroups(),
    loadRooms(),
    loadAvailableProfiles()
  ])
})
</script>
<template>
  <div class="layout">
    <Sidebar />
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      <h1>Rooms</h1>

      <div class="room-assignment-controls">
        <CustomButton 
          :name="groupAssignmentMode ? 'Cancel Group Assignment' : 'Assign Groups to Room'" 
          @click="toggleGroupAssignmentMode"
          class="group-assignment-btn"
        />
      </div>

      <div v-if="groupAssignmentMode" class="group-assignment-section">
        <h3>Select groups and assign them to a room:</h3>
        <div class="room-selector">
          <label for="roomSelectForGroups">Choose Room:</label>
          <select id="roomSelectForGroups" v-model="selectedRoomIdForGroups" class="room-select">
            <option value="">Select a room...</option>
            <option 
              v-for="room in rooms" 
              :key="room.id" 
              :value="room.id"
            >
              {{ room.name }} ({{ room.current_count }}/{{ room.max_capacity }})
            </option>
          </select>
          <CustomButton 
            v-if="selectedRoomIdForGroups && selectedGroupIds.length > 0"
            :name="`Assign ${selectedGroupIds.length} Group${selectedGroupIds.length > 1 ? 's' : ''} to Room`"
            @click="assignGroupsToRoom"
            class="assign-selected-btn"
          />
        </div>
        <div class="groups-list">
          <div v-for="group in profileGroups.filter(g => g && g.id && g.name)" :key="group.id" class="assigned-group">
            <input 
              type="checkbox"
              :checked="selectedGroupIds.includes(group.id)"
              @change="handleGroupSelect(group.id)"
              class="group-checkbox"
            />
            <span class="group-name">{{ group.name }}</span>
            <span class="group-member-count">({{ group.memberCount || (group.members ? group.members.length : 0) }} profiles)</span>
          </div>
        </div>
        <div v-if="selectedGroupIds.length > 0" class="selection-summary">
          <p><strong>{{ selectedGroupIds.length }} group(s) selected for room assignment</strong></p>
        </div>
      </div>

      <div v-if="isLoadingRooms" class="loading">Loading rooms...</div>
      <div v-else class="rooms-grid">
        <div v-for="room in rooms" :key="room.id" class="room-card">
          <div class="room-header">
            <div class="room-info">
              <h3>{{ room.name }}</h3>
              <p v-if="room.description">{{ room.description }}</p>
            </div>
            <div class="room-capacity">
              <span class="capacity-badge" :class="{ 'full': room.current_count >= room.max_capacity }">
                {{ room.current_count }}/{{ room.max_capacity }}
              </span>
            </div>
          </div>
          <div v-if="room.assignedGroups && room.assignedGroups.length > 0" class="assigned-groups">
            <h4>Assigned Groups:</h4>
            <div class="groups-list">
              <div v-for="group in room.assignedGroups" :key="group.id" class="assigned-group">
                <span class="group-name">{{ group.name }}</span>
                <span class="group-member-count">({{ group.memberCount }} members)</span>
                <CustomButton
                  name="Remove Group"
                  class="remove-group-btn"
                  @click="removeGroupFromRoom(group.id, room.id)"
                />
              </div>
            </div>
          </div>
          <div v-if="room.members && room.members.length > 0" class="room-members-grid">
            <div v-for="member in room.members" :key="member.id" class="room-member-card">
              <div class="member-info">
                <strong class="fullName">{{ member.firstName }} {{ member.lastName }}</strong>
                <span class="member-age">Age: {{ member.age }}</span>
                <span v-if="member.group_name" class="member-group">From: {{ member.group_name }}</span>
              </div>
              <CustomButton
                name="Remove"
                class="remove-btn"
                @click="removeProfileFromRoom(member.id, room.id)"
              />
            </div>
          </div>
          <div v-else class="empty-room">
            <p>No members assigned yet</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}
.main-content {
  margin-left: 70px;
  flex: 1;
  padding: 32px 24px;
  background: #1B3C53;
  min-height: 100vh;
}

/* Group assignment styles */
.group-assignment-section {
  background: #2a1810;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  color: white;
}

.group-assignment-btn {
  background: #8b4513 !important;
  color: white;
}

.group-title-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.group-checkbox {
  width: 1.2rem;
  height: 1.2rem;
}

.assigned-groups {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #8b4513;
}

.assigned-groups h4 {
  margin: 0 0 0.5rem 0;
  color: #8b4513;
  font-size: 1.1rem;
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.assigned-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.group-name {
  font-weight: bold;
  color: #000000;
}

.group-member-count {
  color: #000000;
  font-size: 0.9rem;
}

.remove-group-btn {
  background: #dc3545 !important;
  color: white;
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
}
.fullName {
  color: #000000;
}
.assigned-room {
  color: #28a745;
  font-weight: bold;
  font-size: 0.9rem;
  margin: 0.25rem 0 0 0;
}

.member-group {
  color: #8b4513;
  font-size: 0.8rem;
  font-style: italic;
}

.group-badge {
  background: #8b4513;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-right: 0.5rem;
}

.no-messages {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

/* Room Assignment Styles */
.room-assignment-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.room-assignment-section {
  background: #360379;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.room-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.room-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 200px;
}

.selection-summary {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  padding: 0.5rem;
  margin: 1rem 0;
}

/* Room Cards */
.rooms-section {
  margin: 2rem 0;
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.room-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.room-info h3 {
  margin: 0;
  color: #333;
}

.room-description {
  margin: 0.25rem 0 0 0;
  color: #000000;
  font-size: 0.9rem;
}

.capacity-badge {
  background: #28a745;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
}

.capacity-badge.full {
  background: #dc3545;
}

.room-members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

.room-member-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.member-info {
  display: flex;
  flex-direction: column;
}

.member-age {
  font-size: 0.8rem;
  color: #000000;
}

.empty-room {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.remove-btn {
  background: #dc3545 !important;
  color: white;
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
}

/* Available Profiles */
.available-profiles-section {
  margin: 2rem 0;
}

.available-profiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.available-profile-card {
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
}

.profile-info {
  display: flex;
  flex-direction: column;
}

.profile-age {
  font-size: 0.8rem;
  color: #666;
}

/* Room Badge in Profile List */
.room-badge {
  background: #17a2b8;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-right: 0.5rem;
}

/* Button Styling */
.room-assignment-btn {
  background: #007bff !important;
  color: white;
}

.auto-assign-btn {
  background: #28a745 !important;
  color: white;
}

.assign-selected-btn {
  background: #ffc107 !important;
  color: #212529;
  font-weight: bold;
}

/* Existing styles can remain... */
.selection-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.selected-count {
  color: #007bff;
  font-weight: bold;
}

.create-group-form {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.group-name-input,
.group-description-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
}

.filter {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.filter input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.profiles,.group-profiles-grid{
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

/* Groups Section - Matching rooms section styling */
.groups-section {
  margin: 2rem 0;
}

.profile-groups {
  display: grid;
  gap: 1.5rem;
}

.profile-group {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.group-info h3 {
  margin: 0;
  color: #333;
}

.group-description {
  margin: 0.25rem 0 0 0;
  color: #666;
  font-size: 0.9rem;
}

.profile-count {
  background: #28a745;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
}

.delete-btn {
  background: #dc3545 !important;
  color: white;
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
}

/* Messages Section - Matching rooms section styling */
.messages-section {
  margin: 2rem 0;
}

.messages-title {
  color: #333;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  text-align: center;
}

.no-messages {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.messages-container {
  display: grid;
  gap: 1.5rem;
}

.message-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.author-name {
  font-size: 1rem;
  font-weight: bold;
  color: #333;
}

.message-content {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .group-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .group-profiles-grid {
    flex-direction: column;
  }
  
  .message-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>