<script setup>
import { computed, ref, onMounted } from 'vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import AddIcon from '@/components/icons/addIcon.vue'
import { useRouter, useRoute } from 'vue-router'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import Sidebar from '@/components/sidebar.vue'
import selectionIcon from '@/components/icons/selectionIcon.vue'

const breadcrumbs = [
  { label: 'Home', route: { name: 'profilePage' } }
]
const selectedProfessions = ref([])
const selectedRooms = ref([])
const selectedGroupNames = ref([])
const ageRange = ref({ min: '', max: '' })
const professionsOptions = ref([])
const roomsOptions = ref([])
const groupsOptions = ref([])
const showFilterPanel = ref(false)
const profiles = ref([])
const router = useRouter()
const route = useRoute()
const filterText = ref("")
const filteredProfiles = ref([])
const showFiltered = ref(false)
const selectedProfiles = ref([])
const profileGroups = ref([])
const newGroupName = ref('')
const newGroupDescription = ref('')
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
  let profilesToShow = profiles.value || []
  
  // Apply search filter first
  if (showFiltered.value && filteredProfiles.value.length > 0) {
    profilesToShow = filteredProfiles.value
  }
  
  // Apply advanced filters
  if (hasActiveFilters.value) {
    profilesToShow = applyFilters(profilesToShow)
  }
  
  return profilesToShow
})
const showGroupCreationForm = ref(false)
const groupCreationMode = ref('empty')

const profilesWithMessages = computed(() => {
  const profilesToShow = displayProfiles.value
  return profilesToShow.filter(profile => profile.message && profile.message.trim() !== '')
})

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    selectedProfiles.value = []
  }
  groupCreationMode.value = 'with-profiles'
  showGroupCreationForm.value = true
}

const hasActiveFilters = computed(() => {
  return selectedProfessions.value.length > 0 || 
         selectedRooms.value.length > 0 || 
         selectedGroupNames.value.length > 0 ||
         ageRange.value.min !== '' || 
         ageRange.value.max !== ''
})
const handleLogout = () => {
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('userEmail')
  router.push('/login')
}
const confirmLogout = () => {
  if (confirm('Are you sure you want to log out?')) {
    handleLogout()
  }
}
const userEmail = localStorage.getItem('userEmail')
const filteredProfilesCount = computed(() => {
  return applyFilters().length
})
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
      alert(`${result.message}`)
      
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
      alert(`${result.message}`)
    }
  } catch (error) {
    console.error('Network error assigning groups to room:', error)
    alert('Network error. Please check if the server is running and try again.')
  }
}

async function createProfileGroup() {
  if (!newGroupName.value.trim()) {
    alert('Please enter a group name')
    return
  }

  // For 'with-profiles' mode, require at least one profile
  if (groupCreationMode.value === 'with-profiles' && selectedProfiles.value.length === 0) {
    alert('Please select at least one profile or switch to creating an empty group')
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
        profileIds: selectedProfiles.value // Will be empty array for empty groups
      })
    })

    const result = await response.json()

    if (result.success) {
      console.log(`Created group "${result.group.name}"${result.group.memberCount > 0 ? ` with ${result.group.memberCount} profiles` : ' (empty group)'}`)
      
      // Reset form
      cancelGroupCreation()
      
      // Refresh groups list
      await loadProfileGroups()
      await loadProfiles()
      
    } else {
      alert(result.message || 'Failed to create group')
    }
  } catch (error) {
    console.error('Error creating group:', error)
    alert('Error creating group. Please try again.')
  }
}
function applyFilters(baseProfiles = profiles.value) {
  let filtered = [...baseProfiles]
  
  // Filter by professions (AND logic - profile must have ALL selected professions)
  if (selectedProfessions.value.length > 0) {
    filtered = filtered.filter(profile => {
      const profileProfessions = Array.isArray(profile.professions) 
        ? profile.professions.map(p => p.name || p)
        : []
      
      return selectedProfessions.value.every(selectedProf => 
        profileProfessions.includes(selectedProf)
      )
    })
  }
  
  // Filter by rooms
  if (selectedRooms.value.length > 0) {
    filtered = filtered.filter(profile => {
      return selectedRooms.value.includes(profile.room_name) || 
             (selectedRooms.value.includes('Unassigned') && !profile.room_name)
    })
  }

  // Filter by groups (by name)
  if (selectedGroupNames.value.length > 0) {
    filtered = filtered.filter(profile => {
      const profileGroupName = profile.group_name || ''
      if (!profileGroupName) {
        return selectedGroupNames.value.includes('Unassigned')
      }
      return selectedGroupNames.value.includes(profileGroupName)
    })
  }
  
  // Filter by age range
  if (ageRange.value.min !== '' || ageRange.value.max !== '') {
    filtered = filtered.filter(profile => {
      const age = parseInt(profile.age)
      const minAge = ageRange.value.min !== '' ? parseInt(ageRange.value.min) : 0
      const maxAge = ageRange.value.max !== '' ? parseInt(ageRange.value.max) : Infinity
      
      return age >= minAge && age <= maxAge
    })
  }
  
  return filtered
}

function toggleProfession(profession) {
  const index = selectedProfessions.value.indexOf(profession)
  if (index > -1) {
    selectedProfessions.value.splice(index, 1)
  } else {
    selectedProfessions.value.push(profession)
  }
}

function toggleRoom(room) {
  const index = selectedRooms.value.indexOf(room)
  if (index > -1) {
    selectedRooms.value.splice(index, 1)
  } else {
    selectedRooms.value.push(room)
  }
}

function toggleGroupFilter(groupName) {
  const index = selectedGroupNames.value.indexOf(groupName)
  if (index > -1) {
    selectedGroupNames.value.splice(index, 1)
  } else {
    selectedGroupNames.value.push(groupName)
  }
}

function clearAllFilters() {
  selectedProfessions.value = []
  selectedRooms.value = []
  ageRange.value = { min: '', max: '' }
  showFilterPanel.value = false
}
function showEmptyGroupForm() {
  showGroupCreationForm.value = true
  groupCreationMode.value = 'empty'
  selectionMode.value = false
  selectedProfiles.value = []
}
function toggleFilterPanel() {
  showFilterPanel.value = !showFilterPanel.value
}

// -------------------- Load Filter Options --------------------
async function loadFilterOptions() {
  try {
    // Load professions
    const profResponse = await fetch('http://localhost:3000/api/professions')
    if (profResponse.ok) {
      const professions = await profResponse.json()
      professionsOptions.value = professions.map(p => p.name)
    }
    
    // Extract unique rooms from loaded profiles and rooms data
    const uniqueRooms = new Set()
    
    // Add rooms from rooms array
    rooms.value.forEach(room => {
      if (room.name) uniqueRooms.add(room.name)
    })
    
    // Add rooms from profiles
    profiles.value.forEach(profile => {
      if (profile.room_name) uniqueRooms.add(profile.room_name)
    })
    
    // Add "Unassigned" option
    uniqueRooms.add('Unassigned')
    
  // Collect groups from profileGroups and profiles
  const uniqueGroups = new Set()
  profileGroups.value.forEach(g => { if (g && g.name) uniqueGroups.add(g.name) })
  profiles.value.forEach(p => { if (p && p.group_name) uniqueGroups.add(p.group_name) })
  uniqueGroups.add('Unassigned')

  groupsOptions.value = Array.from(uniqueGroups).sort()
    
    roomsOptions.value = Array.from(uniqueRooms).sort()
    
  } catch (error) {
    console.error('Error loading filter options:', error)
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

async function deleteProfileGroup(groupId) {
  if (!confirm('Are you sure you want to delete this group?')) return

  try {
    const response = await fetch(`http://localhost:3000/api/groups/${groupId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      console.log('Group deleted successfully')
      await loadProfileGroups()
      await loadProfiles()
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
function cancelGroupCreation() {
  showGroupCreationForm.value = false
  selectionMode.value = false
  selectedProfiles.value = []
  newGroupName.value = ''
  newGroupDescription.value = ''
  groupCreationMode.value = 'empty'
}
function editProfile(id) {
  console.log('Editing profile with id:', id)
  router.push({ name: 'infoPage', params: { id } })
}

async function deleteProfile(id) {
  if (!confirm('Are you sure you want to delete this profile?')) return

  try {
    const response = await fetch(`http://localhost:3000/api/profiles/${id}`, {
      method: 'DELETE',
    })

    const result = await response.json()

    if (result.success) {
      await Promise.all([
        loadProfiles(),
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

async function changeProfileGroup(profile) {
  try {
    // Fetch available groups
    const resp = await fetch('http://localhost:3000/api/groups')
    if (!resp.ok) {
      alert('Failed to load groups')
      return
    }

    const groups = await resp.json()
    if (!groups || groups.length === 0) {
      alert('No groups available')
      return
    }

    // Build a simple selection prompt (choose by group name)
    const choices = groups.map(g => `${g.name} (${g.id})`).join('\n')
    const input = prompt(`Choose a group by typing its NAME (case-insensitive):\n\n${choices}`)
    if (!input) return

    const typed = input.trim()
    if (!typed) return

    // Try exact name match (case-insensitive)
    let match = groups.find(g => g.name && g.name.toLowerCase() === typed.toLowerCase())
    // If no exact name match, allow partial name match
    if (!match) {
      match = groups.find(g => g.name && g.name.toLowerCase().includes(typed.toLowerCase()))
    }
    // If still no match, allow user to paste an id as fallback
    if (!match) {
      match = groups.find(g => g.id === typed)
    }

    if (!match) {
      alert('Invalid group name or id')
      return
    }

    const targetGroupId = match.id

    const res = await fetch(`http://localhost:3000/api/profiles/${profile.id}/group`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetGroupId })
    })

    const result = await res.json()
    if (res.ok && result.success) {
      alert('Profile moved to new group')
      await Promise.all([loadProfiles(), loadProfileGroups()])
    } else {
      alert(result.message || 'Failed to change group')
    }
  } catch (error) {
    console.error('Error changing profile group:', error)
    alert('Network error')
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
      p.lastName.toLowerCase().includes(search) ||
      (p.firstName + ' ' + p.lastName).toLowerCase().includes(search)
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
   await loadFilterOptions()
})
</script>

<template>
  <div class="layout">
    <Sidebar />
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      <h1 class="title">Profile Management</h1>

      <!-- Room Assignment Controls -->
      <div class="assignment-controls">
        <CustomButton 
          :name="roomSelectionMode ? 'Cancel Room Assignment' : 'Assign to Rooms'" 
          @click="toggleRoomSelectionMode"
          class="room-assignment-btn"
        />
        <CustomButton 
          name="Auto-Assign All" 
          @click="assignToRooms"
          class="auto-assign-btn"
        />
        <CustomButton 
          :name="groupAssignmentMode ? 'Cancel Group Assignment' : 'Assign Groups to Room'" 
          @click="toggleGroupAssignmentMode"
          class="group-assignment-btn"
        />
        <button @click="confirmLogout" class="logout-btn-confirm">
          Logout
        </button>
      </div>

      <!-- Room Assignment Interface -->
      <div v-if="roomSelectionMode" class="assignment-section">
        <h3>Select profiles and assign them to a room:</h3>
        
        <div class="room-selector">
          <label for="roomSelect">Choose Room:</label>
          <select id="roomSelect" v-model="selectedRoomId" class="room-select">
            <option value="">Select a room...</option>
            <option 
              v-for="room in rooms" 
              :key="room.id" 
              :value="room.id"
              :disabled="room.current_count >= room.max_capacity"
            >
              {{ room.name }} ({{ room.current_count }}/{{ room.max_capacity }})
              {{ room.current_count >= room.max_capacity ? ' - FULL' : '' }}
            </option>
          </select>
          
          <CustomButton 
            v-if="selectedRoomId && selectedProfiles.length > 0"
            :name="`Add ${selectedProfiles.length} Profile${selectedProfiles.length > 1 ? 's' : ''} to Room`"
            @click="addSelectedProfilesToRoom"
            class="assign-selected-btn"
          />
        </div>

        <div v-if="selectedProfiles.length > 0" class="selection-summary">
          <p><strong>{{ selectedProfiles.length }} profile(s) selected for room assignment</strong></p>
        </div>
      </div>

      <!-- Group Assignment Interface -->
      <div v-if="groupAssignmentMode" class="assignment-section">
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
        <div class="groups-selection">
          <div v-for="group in profileGroups.filter(g => g && g.id && g.name)" :key="group.id" class="group-item">
            <input 
              type="checkbox"
              :checked="selectedGroupIds.includes(group.id)"
              @change="handleGroupSelect(group.id)"
              class="group-checkbox"
            />
            <span class="group-name">{{ group.name }}</span>
            <span class="group-member-count">({{ group.memberCount || 0 }} profiles)</span>
          </div>
        </div>
        <div v-if="selectedGroupIds.length > 0" class="selection-summary">
          <p><strong>{{ selectedGroupIds.length }} group(s) selected for room assignment</strong></p>
        </div>
      </div>

      <!-- Updated Group Creation Controls -->
      <div class="group-controls">
        <CustomButton 
          name="Create Empty Group" 
          @click="showEmptyGroupForm"
          class="group-create-empty-btn"
        />
        <CustomButton 
          :name="selectionMode ? 'Cancel Selection' : 'Create Group with Profiles'" 
          @click="toggleSelectionMode"
          class="group-create-btn"
        />
        <CustomButton 
          v-if="showGroupCreationForm"
          name="Cancel" 
          @click="cancelGroupCreation"
          class="cancel-btn"
        />
        <span v-if="selectionMode && selectedProfiles.length > 0" class="selected-count">
          {{ selectedProfiles.length }} selected
        </span>
      </div>

      <!-- Filter Section -->
      <div class="filter-section">
        <div class="filter-controls">
          <input 
            id="filter"
            v-model="filterText"
            type="text" 
            placeholder="Search by name..."
            class="filter-input"
          >
          <CustomButton name="Filter" @click="handleFilterButton" class="filter-button" />
          <CustomButton 
            v-if="showFiltered" 
            name="Clear Filter" 
            @click="showFiltered = false; filterText = ''" 
            class="clear-filter-button" 
          />
        </div>
        <div v-if="showFiltered" class="filter-results">
          Showing {{ filteredProfiles.length }} of {{ profiles.length }} profiles
        </div>
      </div>

      <!-- Advanced Filter Section -->
      <div class="advanced-filter-section">
        <div class="filter-toggle">
          <CustomButton 
            :name="showFilterPanel ? 'Hide Advanced Filters' : 'Show Advanced Filters'" 
            @click="toggleFilterPanel"
            class="filter-toggle-btn"
          />
          <span v-if="hasActiveFilters" class="active-filters-indicator">
            {{ filteredProfilesCount }} of {{ profiles.length }} profiles match filters
          </span>
        </div>

        <div v-if="showFilterPanel" class="filter-panel">
          <!-- Age Range Filter -->
          <div class="filter-group">
            <h3 class="filter-group-title">Age Range</h3>
            <div class="age-range-inputs">
              <div class="age-input-group">
                <label for="minAge">Min Age:</label>
                <input 
                  id="minAge"
                  v-model="ageRange.min"
                  type="number" 
                  placeholder="Min"
                  class="age-input"
                  min="0"
                  max="120"
                />
              </div>
              <div class="age-input-group">
                <label for="maxAge">Max Age:</label>
                <input 
                  id="maxAge"
                  v-model="ageRange.max"
                  type="number" 
                  placeholder="Max"
                  class="age-input"
                  min="0"
                  max="120"
                />
              </div>
            </div>
          </div>

          <!-- Professions Filter -->
          <div class="filter-group">
            <h3 class="filter-group-title">Professions</h3>
            <div class="profession-filters">
              <div 
                v-for="profession in professionsOptions" 
                :key="profession" 
                class="profession-filter-item"
              >
                <label class="profession-checkbox">
                  <input 
                    type="checkbox"
                    :value="profession"
                    :checked="selectedProfessions.includes(profession)"
                    @change="toggleProfession(profession)"
                    class="checkbox-input"
                  />
                  <span class="checkbox-label">{{ profession }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Rooms Filter -->
          <div class="filter-group">
            <h3 class="filter-group-title">Rooms</h3>
            <div class="room-filters">
              <div 
                v-for="room in roomsOptions" 
                :key="room" 
                class="room-filter-item"
              >
                <label class="room-checkbox">
                  <input 
                    type="checkbox"
                    :value="room"
                    :checked="selectedRooms.includes(room)"
                    @change="toggleRoom(room)"
                    class="checkbox-input"
                  />
                  <span class="checkbox-label">{{ room }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Groups Filter -->
          <div class="filter-group">
            <h3 class="filter-group-title">Groups</h3>
            <div class="room-filters">
              <div 
                v-for="group in groupsOptions" 
                :key="group" 
                class="room-filter-item"
              >
                <label class="room-checkbox">
                  <input 
                    type="checkbox"
                    :value="group"
                    :checked="selectedGroupNames.includes(group)"
                    @change="toggleGroupFilter(group)"
                    class="checkbox-input"
                  />
                  <span class="checkbox-label">{{ group }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Active Filters Display -->
          <div v-if="hasActiveFilters" class="active-filters-display">
            <h3>Active Filters:</h3>
            <div class="filter-tags">
              <!-- Age Range Tags -->
              <span v-if="ageRange.min !== '' || ageRange.max !== ''" class="filter-tag age-tag">
                Age: {{ ageRange.min || '0' }}-{{ ageRange.max || '∞' }}
                <button 
                  @click="ageRange.min = ''; ageRange.max = ''"
                  class="remove-filter"
                  title="Remove age filter"
                >
                  ×
                </button>
              </span>
              
              <!-- Profession Tags -->
              <span 
                v-for="profession in selectedProfessions" 
                :key="'prof-' + profession"
                class="filter-tag profession-tag"
              >
                {{ profession }}
                <button 
                  @click="toggleProfession(profession)"
                  class="remove-filter"
                  title="Remove profession filter"
                >
                  ×
                </button>
              </span>
              
              <!-- Room Tags -->
              <span 
                v-for="room in selectedRooms" 
                :key="'room-' + room"
                class="filter-tag room-tag"
              >
                {{ room }}
                <button 
                  @click="toggleRoom(room)"
                  class="remove-filter"
                  title="Remove room filter"
                >
                  ×
                </button>
              </span>

              <!-- Group Tags -->
              <span 
                v-for="g in selectedGroupNames" 
                :key="'group-' + g"
                class="filter-tag profession-tag"
              >
                {{ g }}
                <button 
                  @click="toggleGroupFilter(g)"
                  class="remove-filter"
                  title="Remove group filter"
                >
                  ×
                </button>
              </span>
            </div>
          </div>

          <!-- Filter Actions -->
          <div class="filter-actions">
            <CustomButton 
              v-if="hasActiveFilters"
              name="Clear All Filters" 
              @click="clearAllFilters"
              class="clear-filters-btn"
            />
          </div>
        </div>
      </div>

      <!-- Updated Create Group Form -->
      <div v-if="showGroupCreationForm" class="create-group-form">
        <div class="form-header">
          <h3 v-if="groupCreationMode === 'empty'">Create Empty Group</h3>
          <h3 v-else>Create Group with Selected Profiles ({{ selectedProfiles.length }})</h3>
        </div>
        
        <div class="form-inputs">
          <input 
            v-model="newGroupName"
            type="text" 
            placeholder="Enter group name (required)"
            class="group-name-input"
            required
          />
          <input 
            v-model="newGroupDescription"
            type="text" 
            placeholder="Optional description"
            class="group-description-input"
          />
        </div>
        
        <div class="form-actions">
          <CustomButton 
            :name="groupCreationMode === 'empty' ? 'Create Empty Group' : `Create Group with ${selectedProfiles.length} Profile${selectedProfiles.length !== 1 ? 's' : ''}`"
            @click="createProfileGroup" 
            class="create-group-submit-btn"
          />
        </div>
        
        <div v-if="groupCreationMode === 'with-profiles' && selectedProfiles.length === 0" class="info-message">
          <p>💡 No profiles selected. You can still create an empty group, or select profiles from the table below.</p>
        </div>
      </div>

      <!-- Profiles Table -->
      <div class="profiles-table-container">
        <h2 class="section-title">Profiles ({{ displayProfiles.length }})</h2>
        
        <div v-if="displayProfiles.length === 0" class="no-profiles">
          <p>No profiles found. <button @click="handleAddButton" class="link-button">Add your first profile</button></p>
        </div>
        
        <table v-else class="profiles-table">
          <thead>
            <tr>
              <th v-if="selectionMode || roomSelectionMode" class="select-column">
                <selectionIcon />
              </th>
              <th class="avatar-column">Photo</th>
              <th class="name-column">Full Name</th>
              <th class="age-column">Age</th>
              <th class="professions-column">Professions</th>
              <th class="group-column">Group</th>
              <th class="room-column">Room</th>
              <th class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="profile in displayProfiles" 
              :key="profile.id"
              :class="{ 'selected-row': selectedProfiles.includes(profile.id) }"
            >  
              <td v-if="selectionMode || roomSelectionMode" class="select-cell">
                <input 
                  type="checkbox"
                  :checked="selectedProfiles.includes(profile.id)"
                  @change="handleProfileSelect(profile.id)"
                  class="profile-checkbox"
                />
              </td>
              <td class="avatar-cell">
                <div class="profile-avatar-small">
                  <img 
                    v-if="profile.avatarUrl" 
                    :src="profile.avatarUrl.startsWith('http') ? profile.avatarUrl : `http://localhost:3000/${profile.avatarUrl.replace(/^\/+/, '')}`"
                    :alt="`${profile.firstName} ${profile.lastName}`"
                    class="avatar-thumbnail"
                    @error="$event.target.style.display = 'none'"
                  />
                  <div v-else class="avatar-placeholder-small">
                    <span>{{ profile.firstName.charAt(0) }}{{ profile.lastName.charAt(0) }}</span>
                  </div>
                </div>
              </td>
              <td class="name-cell">
                <strong>{{ profile.firstName }} {{ profile.lastName }}</strong>
              </td>
              <td class="age-cell">{{ profile.age }}</td>
              <td class="professions-cell">
                <span 
                  v-if="profile.professions && profile.professions.length > 0" 
                  class="professions-list"
                >
                  {{ profile.professions.map(p => p.name || p).join(', ') }}
                </span>
                <span v-else class="no-professions">-</span>
              </td>
              <td class="group-cell">
                <span v-if="profile.group_name" class="group-badge">
                  {{ profile.group_name }}
                </span>
                <span v-else class="no-group">-</span>
              </td>
              <td class="room-cell">
                <span v-if="profile.room_name" class="room-badge">
                  {{ profile.room_name }}
                </span>
                <span v-else class="no-room">Unassigned</span>
              </td>
              <td class="actions-cell">
                <div class="action-buttons">
                  <CustomButton 
                    name="Edit" 
                    @click="editProfile(profile.id)" 
                    class="edit-btn"
                  />
                  <CustomButton 
                    name="Delete" 
                    @click="deleteProfile(profile.id)" 
                    class="delete-btn"
                  />
                  <CustomButton
                    name="Change Group"
                    class="edit-btn"
                    @click="changeProfileGroup(profile)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Messages Section -->
      <div v-if="profilesWithMessages.length > 0" class="messages-section">
        <h2 class="section-title">Messages from Profiles</h2>
        <div class="messages-container">
          <div 
            v-for="profile in profilesWithMessages" 
            :key="profile.id" 
            class="message-item"
          >
            <div class="message-header">
              <span class="author-name">{{ profile.firstName }} {{ profile.lastName }}</span>
            </div>
            <div class="message-content">
              {{ profile.message }}
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
<style scoped>
/* === General Layout === */
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
  color: #f8f9fa;
}

.title {
  color: #ffffff;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

/* === Add Profile Section === */
.add-profile-section {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: flex-start;
}

/* === Filter Section === */
.filter-section {
  margin-bottom: 1.5rem;
  background: #234a66;
  padding: 1rem;
  border-radius: 8px;
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.group-cell {
  color: #007bff;
}
.name-cell {
    color: #1B3C53;
}
.age-cell {
    color: #1B3C53;
}
.professions-cell {
    color: #1B3C53;
}
.filter-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
/* Add these styles to your profilePage component */

.advanced-filter-section {
  background: #2C5F7A;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #3A6B85;
  overflow: hidden;
}
.action-buttons{
  display: flex;
  gap: 8px;
}
.filter-toggle {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1B3C53;
  border-bottom: 1px solid #3A6B85;
}

.filter-toggle-btn {
  background: #007bff;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.filter-toggle-btn:hover {
  background: #0056b3;
}

.active-filters-indicator {
  color: #28a745;
  font-weight: bold;
  font-size: 0.9em;
}

.filter-panel {
  padding: 20px;
  animation: slideDown 0.3s ease-out;
}
/* Add these styles to your existing CSS */

.group-create-empty-btn {
  background: #28a745 !important;
  color: white;
}

.cancel-btn {
  background: #6c757d !important;
  color: white;
}

.create-group-submit-btn {
  background: #007bff !important;
  color: white;
  font-weight: bold;
}

.create-group-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border: 2px solid #dee2e6;
}

.form-header h3 {
  margin: 0;
  color: #495057;
  font-size: 1.1rem;
}

.form-inputs {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.group-name-input,
.group-description-input {
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  flex: 1;
  min-width: 200px;
  font-size: 0.9rem;
}

.group-name-input:focus,
.group-description-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-actions {
  display: flex;
  justify-content: flex-start;
}

.info-message {
  background: #e7f3ff;
  border: 1px solid #b8daff;
  border-radius: 4px;
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.info-message p {
  margin: 0;
  color: #004085;
  font-size: 0.9rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .group-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .form-inputs {
    flex-direction: column;
  }
  
  .group-name-input,
  .group-description-input {
    min-width: auto;
  }
}
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
  }
}

.filter-group {
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid #3A6B85;
}

.filter-group:last-of-type {
  border-bottom: none;
  margin-bottom: 15px;
}
.avatar-column {
  width: 60px;
  text-align: center;
}

.avatar-cell {
  padding: 8px;
  text-align: center;
}

.profile-avatar-small {
  width: 40px;
  height: 40px;
  margin: 0 auto;
}

.avatar-thumbnail {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ddd;
}

.avatar-placeholder-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: #666;
  border: 2px solid #ddd;
}
.filter-group-title {
  color: #F9F3EF;
  margin-bottom: 12px;
  font-size: 1.1em;
  font-weight: 600;
}

/* Age Range Styles */
.age-range-inputs {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.age-input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.age-input-group label {
  color: #F9F3EF;
  font-size: 0.9em;
  font-weight: 500;
}

.age-input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid #3A6B85;
  border-radius: 4px;
  background: #1B3C53;
  color: #F9F3EF;
  font-size: 14px;
}

.age-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* Profession and Room Filter Styles */
.profession-filters,
.room-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.profession-filter-item,
.room-filter-item {
  display: flex;
  align-items: center;
}

.profession-checkbox,
.room-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
  width: 100%;
}

.profession-checkbox:hover,
.room-checkbox:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.checkbox-input {
  margin-right: 8px;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-label {
  color: #F9F3EF;
  font-size: 0.9em;
  font-weight: 500;
  flex: 1;
}

/* Active Filters Display */
.active-filters-display {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 15px;
  margin: 20px 0;
}

.active-filters-display h3 {
  margin-bottom: 10px;
  font-size: 1em;
  color: #F9F3EF;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 0.8em;
  font-weight: 500;
  color: white;
}

.age-tag {
  background: #17a2b8;
}

.profession-tag {
  background: #007bff;
}

.room-tag {
  background: #28a745;
}

.remove-filter {
  background: none;
  border: none;
  color: white;
  margin-left: 6px;
  cursor: pointer;
  font-size: 1.2em;
  line-height: 1;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.remove-filter:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* Filter Actions */
.filter-actions {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.clear-filters-btn {
  background-color: #dc3545;
  border-color: #dc3545;
  color: white;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.clear-filters-btn:hover {
  background-color: #c82333;
  border-color: #bd2130;
}

/* Profile Count Styles */
.filter-count {
  color: #28a745;
  font-weight: normal;
  font-size: 0.9em;
}

.total-count {
  color: #F9F3EF;
  font-weight: normal;
  font-size: 0.9em;
}

/* Responsive Design */
@media (max-width: 768px) {
  .filter-toggle {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
    text-align: center;
  }
  
  .age-range-inputs {
    justify-content: center;
  }
  
  .profession-filters,
  .room-filters {
    grid-template-columns: 1fr;
  }
  
  .filter-tags {
    justify-content: center;
  }
}
.filter-button {
  background: #007bff !important;
  color: white;
}

.clear-filter-button {
  background: #dc3545 !important;
  color: white;
}

.filter-results {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #f8f9fa;
}

/* === Assignment Controls === */
.assignment-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.room-assignment-btn {
  background: #007bff !important;
  color: white;
}

.auto-assign-btn {
  background: #28a745 !important;
  color: white;
}

.group-assignment-btn {
  background: #8b4513 !important;
  color: white;
}

.assign-selected-btn {
  background: #ffc107 !important;
  color: #212529;
  font-weight: bold;
}

/* === Assignment Sections === */
.assignment-section {
  background: #234a66;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
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
.logout-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background: #c82333;
}

.logout-btn-confirm {
  background: #888888;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.logout-btn-confirm:hover {
  background: #e8630a;
}

.logout-btn-header {
  background: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.logout-btn-header:hover {
  background: #dc3545;
  color: white;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  color: #666;
  font-size: 0.9rem;
}
.selection-summary {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  padding: 0.5rem;
  margin: 1rem 0;
}

/* === Group Creation === */
.group-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.group-create-btn {
  background: #8b4513 !important;
  color: white;
}

.selected-count {
  color: #ffc107;
  font-weight: bold;
}

.create-group-form {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.group-name-input,
.group-description-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
}

/* === Profiles Table === */
.profiles-table-container {
  margin-top: 2rem;
  background: #234a66;
  padding: 1rem;
  border-radius: 8px;
}

.section-title {
  color: #ffffff;
  margin-bottom: 1rem;
}

.profiles-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.profiles-table th,
.profiles-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #ddd;
  font-size: 0.9rem;
}

.profiles-table th {
  background: #007bff;
  color: white;
  font-weight: bold;
}

.profiles-table tr:hover {
  background: #f1f1f1;
}

.selected-row {
  background: #d4edda !important;
}

/* Badges */
.group-badge {
  background: #007bff;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-right: 0.5rem;
}

.room-badge {
  background: #17a2b8;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  margin-right: 0.5rem;
}

.no-professions,
.no-group,
.no-room {
  color: #999;
  font-style: italic;
}

/* Actions */
.actions-cell {
  display: flex;
  gap: 0.5rem;
  }

.edit-btn {
  background: #007bff !important;
  color: white;
}

.delete-btn {
  background: #dc3545 !important;
  color: white;
}

/* === Empty State === */
.no-profiles {
  text-align: center;
  padding: 2rem;
  background: #234a66;
  border-radius: 8px;
  color: #f8f9fa;
}

.link-button {
  background: none;
  border: none;
  color: #ffc107;
  text-decoration: underline;
  cursor: pointer;
  font-weight: bold;
}

/* === Messages Section === */
.messages-section {
  margin: 2rem 0;
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
}

/* === Responsive === */
@media (max-width: 768px) {
  .assignment-controls {
    flex-direction: column;
  }
  .room-selector {
    flex-direction: column;
    align-items: flex-start;
  }
  .group-controls {
    flex-direction: column;
    align-items: flex-start;
  }
}

</style>