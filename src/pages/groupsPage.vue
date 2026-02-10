<script setup>
import { computed, ref, onMounted } from 'vue'
import Sidebar from '@/components/sidebar.vue'
import profileCotainer from '@/components/profile_requirement/profileCotainer.vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import AddIcon from '@/components/icons/addIcon.vue'
import { useRouter, useRoute } from 'vue-router'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import selectionIcon from '@/components/icons/selectionIcon.vue'

const breadcrumbs = [
  { label: 'Home', route: { name: 'profilePage' } },
  { label: 'Groups', route: null }
]

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
const selectedSubjects = ref([])
const availableSubjects = ref([])
const isLoadingSubjects = ref(false)
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

// NEW: Edit group modal
const isEditingGroup = ref(false)
const editingGroup = ref(null)
const editGroupName = ref('')
const editGroupDescription = ref('')
const editSelectedSubjects = ref([])
const editSelectedProfiles = ref([])
const availableProfilesForSelection = ref([])
const isLoadingAvailableProfiles = ref(false)
// Group assignment to rooms
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
  const profilesToShow = displayProfiles.value;
  return profilesToShow.filter(profile => profile.message && profile.message.trim() !== '')
})

async function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (selectionMode.value) {
    // Load available profiles when entering selection mode
    await loadAvailableProfilesForGroup()
  } else {
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
    const response = await fetch(`http://localhost:3000/api/rooms/${selectedRoomIdForGroups.value}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groupIds: selectedGroupIds.value })
    });

    const result = await response.json();

    if (result.success) {
      alert(result.message)
      
      selectedGroupIds.value = []
      groupAssignmentMode.value = false
      selectedRoomIdForGroups.value = ''
      
      await loadRooms()
      await loadAvailableProfiles()
      await loadProfiles()
      await loadProfileGroups()
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
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Group removed from room successfully')
      await loadRooms()
      await loadAvailableProfiles()
      await loadProfiles()
      await loadProfileGroups()
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

  if (selectedSubjects.value.length === 0) {
    alert('Please select at least one subject')
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
        profileIds: selectedProfiles.value,
        subjectIds: selectedSubjects.value
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Created group "${result.group.name}" with ${result.group.memberCount} profiles`)
      
      newGroupName.value = ''
      newGroupDescription.value = ''
      selectedProfiles.value = []
      selectedSubjects.value = []
      isCreatingGroup.value = false
      selectionMode.value = false
      
      await loadProfileGroups()
      
    } else {
      alert(result.message || 'Failed to create group')
    }
  } catch (error) {
    console.error('Error creating group:', error)
    alert('Error creating group. Please try again.')
  }
}

// NEW: Open edit group modal
async function openEditGroup(group) {
  try {
    isLoadingAvailableProfiles.value = true
    
    // Load group details including members and subjects
    const [groupDetails, groupSubjects, availableProfiles] = await Promise.all([
      fetch(`http://localhost:3000/api/groups/${group.id}`).then(r => r.json()),
      fetch(`http://localhost:3000/api/groups/${group.id}/subjects`).then(r => r.json()),
      fetch(`http://localhost:3000/api/profiles/available-for-group/${group.id}`).then(r => r.json())
    ]);

    editingGroup.value = group
    editGroupName.value = groupDetails.name
    editGroupDescription.value = groupDetails.description || ''
    editSelectedSubjects.value = groupSubjects.map(s => s.id)
    editSelectedProfiles.value = groupDetails.members.map(m => m.id)
    availableProfilesForSelection.value = availableProfiles
    isEditingGroup.value = true
  } catch (error) {
    console.error('Error loading group details:', error)
    alert('Failed to load group details')
  } finally {
    isLoadingAvailableProfiles.value = false
  }
}

// NEW: Save edited group
async function saveEditedGroup() {
  if (!editGroupName.value.trim()) {
    alert('Please enter a group name')
    return
  }

  if (editSelectedSubjects.value.length === 0) {
    alert('Please select at least one subject')
    return
  }

  if (editSelectedProfiles.value.length === 0) {
    alert('Please select at least one member')
    return
  }

  try {
    const response = await fetch(`http://localhost:3000/api/groups/${editingGroup.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: editGroupName.value.trim(),
        description: editGroupDescription.value.trim(),
        subjectIds: editSelectedSubjects.value,
        profileIds: editSelectedProfiles.value
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('Group updated successfully')
      closeEditGroup()
      await loadProfileGroups()
    } else {
      alert(result.message || 'Failed to update group')
    }
  } catch (error) {
    console.error('Error updating group:', error)
    alert('Error updating group. Please try again.')
  }
}

// NEW: Close edit modal
function closeEditGroup() {
  isEditingGroup.value = false
  editingGroup.value = null
  editGroupName.value = ''
  editGroupDescription.value = ''
  editSelectedSubjects.value = []
  editSelectedProfiles.value = []
  availableProfilesForSelection.value = []
}

// NEW: Handle edit profile selection
function handleEditProfileSelect(profileId) {
  const index = editSelectedProfiles.value.indexOf(profileId)
  if (index > -1) {
    editSelectedProfiles.value.splice(index, 1)
  } else {
    editSelectedProfiles.value.push(profileId)
  }
}

async function loadRooms() {
  try {
    isLoadingRooms.value = true
    const response = await fetch('http://localhost:3000/api/rooms')
    if (response.ok) {
      const roomsData = await response.json()
      
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
    });

    const result = await response.json();

    if (result.success) {
      await loadRooms()
      await loadAvailableProfiles()
      await loadProfiles()
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
    });

    const result = await response.json();

    if (result.success) {
      alert(`${result.message}${result.skippedCount > 0 ? ` (${result.skippedCount} profiles were already assigned)` : ''}`)
      
      selectedProfiles.value = []
      roomSelectionMode.value = false
      selectedRoomId.value = ''
      
      await loadRooms()
      await loadAvailableProfiles()
      await loadProfiles()
    } else {
      alert(result.message || 'Failed to add profiles to room')
    }
  } catch (error) {
    console.error('Error adding profiles to room:', error)
    alert('Error adding profiles to room. Please try again.')
  }
}

async function removeProfileFromRoom(profileId, roomId) {
  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${roomId}/members/${profileId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      await loadRooms()
      await loadAvailableProfiles()
      await loadProfiles()
    } else {
      alert(result.message || 'Failed to remove profile from room')
    }
  } catch (error) {
    console.error('Error removing profile from room:', error)
    alert('Error removing profile from room. Please try again.')
  }
}

async function deleteProfileGroup(groupId) {
  if (!confirm('Are you sure you want to delete this group?')) return

  try {
    const response = await fetch(`http://localhost:3000/api/groups/${groupId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
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
    
    const response = await fetch('http://localhost:3000/api/groups')
    if (response.ok) {
      const groups = await response.json()
      
      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          try {
            const detailResponse = await fetch(`http://localhost:3000/api/groups/${group.id}`)
            if (detailResponse.ok) {
              return await detailResponse.json()
            }
            return { ...group, members: [] }
          } catch (error) {
            console.error(`Error loading members for group ${group.id}:`, error)
            return { ...group, members: [] }
          }
        })
      )
      
      profileGroups.value = groupsWithMembers
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
  router.push({ name: 'infoPage', params: { id } })
}

async function deleteProfile(id) {
  try {
    const response = await fetch(`http://localhost:3000/api/profiles/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      profiles.value = profiles.value.filter(p => p.id !== id);
      await loadProfileGroups()
      await loadRooms()
    }
  } catch (error) {
    console.error('Error deleting profile:', error);
  }
}

async function loadSubjects() {
  isLoadingSubjects.value = true
  try {
    const response = await fetch('http://localhost:3000/api/subjects')
    if (!response.ok) throw new Error('Failed to load subjects')
    availableSubjects.value = await response.json()
  } catch (error) {
    console.error('Error loading subjects:', error)
  } finally {
    isLoadingSubjects.value = false
  }
}
async function loadAvailableProfilesForGroup() {
  try {
    const response = await fetch('http://localhost:3000/api/profiles/unassigned')
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to load available profiles')
    }
    
    const loadedProfiles = await response.json()
    profiles.value = loadedProfiles
    console.log('Loaded profiles:', loadedProfiles.length) // Debug log
  } catch (error) {
    console.error('Error loading available profiles:', error)
    profiles.value = []
  }
}
async function loadProfiles() {
  try {
    const response = await fetch('http://localhost:3000/api/profiles')
    if (response.ok) {
      const apiProfiles = await response.json()
      profiles.value = apiProfiles.map(profile => ({
        ...profile,
        isSelectable: true
      }))
    }
  } catch (error) {
    console.error('Error fetching profiles list:', error)
  }
}

function handleFilterButton() {
  if (!filterText.value) {
    showFiltered.value = false
    filteredProfiles.value = []
    return
  }
  
  const search = filterText.value.toLowerCase().trim();
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
    const res = await fetch('http://localhost:3000/api/assignRooms', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(`${data.message}${data.unassignedRemaining > 0 ? ` (${data.unassignedRemaining} profiles couldn't be assigned due to room capacity)` : ''}`);
      await loadRooms()
      await loadAvailableProfiles()
      await loadProfiles()
    } else {
      alert(data.message || 'Assignment failed.');
    }
  } catch (error) {
    console.error(error);
    alert('Server error during assignment.');
  }
};

onMounted(async () => {
  await loadProfiles()
  await loadProfileGroups()
  await loadRooms()
  await loadAvailableProfiles()
  await loadSubjects()
})
</script>

<template>
  <div class="layout">
    <Sidebar />
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      <h1>Groups Management</h1>

      <!-- Create Group Section -->
      <div class="create-section">
        <CustomButton 
          :name="isCreatingGroup ? 'Cancel' : 'Create New Group'" 
          @click="isCreatingGroup = !isCreatingGroup"
        />
      </div>

      <!-- Create Group Form -->
      <div v-if="isCreatingGroup" class="create-group-form">
        <div class="form-row">
          <input 
            v-model="newGroupName" 
            placeholder="Group Name" 
            class="group-name-input"
          />
          <input 
            v-model="newGroupDescription" 
            placeholder="Description (optional)" 
            class="group-description-input"
          />
        </div>

        <!-- Subject Selection -->
        <div class="subjects-section">
          <h3>Select Subjects/Modules</h3>
          <div v-if="isLoadingSubjects">Loading subjects...</div>
          <div v-else class="subjects-grid">
            <label 
              v-for="subject in availableSubjects" 
              :key="subject.id"
              class="subject-checkbox"
            >
              <input 
                type="checkbox" 
                :value="subject.id"
                v-model="selectedSubjects"
              />
              <span>{{ subject.name }}</span>
            </label>
          </div>
          <p v-if="selectedSubjects.length === 0" class="subjects-hint">
            * Please select at least one subject
          </p>
        </div>

        <!-- Profile Selection -->
        <div class="selection-controls">
          <CustomButton 
            :name="selectionMode ? 'Cancel Selection' : 'Select Members'" 
            @click="toggleSelectionMode"
          />
          <span v-if="selectionMode" class="selected-count">
            Selected: {{ selectedProfiles.length }}
          </span>
          <CustomButton 
            v-if="selectionMode && selectedProfiles.length > 0"
            name="Create Group" 
            @click="createProfileGroup"
          />
        </div>

        <div v-if="selectionMode" class="profiles">
  <div v-if="isLoadingAvailableProfiles" class="loading-message">
    Loading available profiles...
  </div>
  <div v-else-if="availableProfilesForSelection.length === 0" class="no-profiles-message">
    No available profiles. All profiles are already assigned to groups.
  </div>
  <profileCotainer
    v-else
    v-for="profile in availableProfilesForSelection"
    :key="profile.id"
    :id="profile.id"
    :firstName="profile.firstName"
    :last-name="profile.lastName"
    :is-selectable="true"
    :is-selected="selectedProfiles.includes(profile.id)"
    @select="handleProfileSelect"
  />
</div>
      </div>

      <!-- Groups List -->
      <div v-if="isLoadingGroups" class="loading">Loading groups...</div>
      <div v-else class="profile-groups">
        <div v-for="group in profileGroups" :key="group.id" class="profile-group">
          <div class="group-header">
            <div class="group-info">
              <h3>{{ group.name }}</h3>
              <p v-if="group.description">{{ group.description }}</p>
              <p v-if="group.assignedRoom" class="assigned-room">Assigned to: {{ group.assignedRoom }}</p>
            </div>
            <span class="profile-count">{{ group.memberCount || (group.members ? group.members.length : 0) }} members</span>
            <div class="group-actions">
              <CustomButton name="Edit" @click="openEditGroup(group)" class="edit-btn" />
              <CustomButton name="Delete" @click="deleteProfileGroup(group.id)" class="delete-btn" />
            </div>
          </div>
          <div class="group-profiles-grid">
            <profileCotainer
              v-for="profile in group.members || []"
              :key="profile.id"
              :id="profile.id"
              :firstName="profile.firstName"
              :last-name="profile.lastName"
              :is-selectable="false"
              :is-selected="false"
            />
          </div>
        </div>
      </div>

      <!-- Edit Group Modal -->
      <div v-if="isEditingGroup" class="modal-overlay" @click.self="closeEditGroup">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Edit Group: {{ editingGroup.name }}</h2>
            <button @click="closeEditGroup" class="close-btn">×</button>
          </div>
          
          <div class="modal-body">
            <!-- Basic Info -->
            <div class="form-section">
              <label>Group Name</label>
              <input v-model="editGroupName" class="form-input" />
            </div>

            <div class="form-section">
              <label>Description</label>
              <textarea v-model="editGroupDescription" class="form-textarea"></textarea>
            </div>

            <!-- Subjects -->
            <div class="form-section">
              <label>Subjects/Modules</label>
              <div class="subjects-grid">
                <label 
                  v-for="subject in availableSubjects" 
                  :key="subject.id"
                  class="subject-checkbox"
                >
                  <input 
                    type="checkbox" 
                    :value="subject.id"
                    v-model="editSelectedSubjects"
                  />
                  <span>{{ subject.name }}</span>
                </label>
              </div>
            </div>

            <!-- Members -->
            <!-- Members -->
<div class="form-section">
  <label>Members ({{ editSelectedProfiles.length }} selected)</label>
  <div v-if="isLoadingAvailableProfiles" class="loading-message">
    Loading available profiles...
  </div>
  <div v-else-if="availableProfilesForSelection.length === 0" class="no-profiles-message">
    No available profiles to add.
  </div>
  <div v-else class="profiles-grid-modal">
    <div
      v-for="profile in availableProfilesForSelection"
      :key="profile.id"
      class="profile-checkbox-item"
      :class="{ selected: editSelectedProfiles.includes(profile.id) }"
      @click="handleEditProfileSelect(profile.id)"
    >
      <input 
        type="checkbox" 
        :checked="editSelectedProfiles.includes(profile.id)"
        @click.stop="handleEditProfileSelect(profile.id)"
      />
      <span>{{ profile.firstName }} {{ profile.lastName }}</span>
    </div>
  </div>
</div>
          </div>

          <div class="modal-footer">
            <CustomButton name="Cancel" @click="closeEditGroup" class="cancel-btn" />
            <CustomButton name="Save Changes" @click="saveEditedGroup" class="save-btn" />
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
  color: white;
}

/* Create Section */
.create-section {
  margin-bottom: 1.5rem;
}

/* Form Styles */
.create-group-form {
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.group-name-input,
.group-description-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 1rem;
}

.group-name-input::placeholder,
.group-description-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

/* Subjects Section */
.subjects-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.subjects-section h3 {
  margin: 0 0 1rem 0;
  color: white;
  font-size: 1.1rem;
}

.subjects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.subject-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.subject-checkbox:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.subject-checkbox input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

.subjects-hint {
  margin-top: 0.5rem;
  color: #ff6b6b;
  font-size: 0.9rem;
  font-style: italic;
}

/* Selection Controls */
.selection-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.selected-count {
  color: #4CAF50;
  font-weight: bold;
  font-size: 1rem;
}
.loading-message,
.no-profiles-message {
  padding: 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  width: 100%;
}

.no-profiles-message {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  color: #FFC107;
}
/* Profiles Grid */
.profiles {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

/* Groups List */
.loading {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.7);
}

.profile-groups {
  display: grid;
  gap: 1.5rem;
}

.profile-group {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.profile-group:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.group-info h3 {
  margin: 0;
  color: white;
  font-size: 1.3rem;
}

.group-info p {
  margin: 0.5rem 0 0 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.assigned-room {
  color: #4CAF50 !important;
  font-weight: bold;
}

.profile-count {
  background: #4CAF50;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
}

.group-actions {
  display: flex;
  gap: 0.5rem;
}

.edit-btn {
  background: #2196F3 !important;
  color: white;
}

.delete-btn {
  background: #f44336 !important;
  color: white;
}

.group-profiles-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: #2a3f54;
  border-radius: 12px;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h2 {
  margin: 0;
  color: white;
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 1.5rem;
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-section label {
  display: block;
  margin-bottom: 0.5rem;
  color: white;
  font-weight: bold;
  font-size: 1rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 1rem;
  font-family: inherit;
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.profiles-grid-modal {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.profile-checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.profile-checkbox-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.profile-checkbox-item.selected {
  background: rgba(76, 175, 80, 0.2);
  border-color: #4CAF50;
}

.profile-checkbox-item input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn {
  background: #757575 !important;
  color: white;
}

.save-btn {
  background: #4CAF50 !important;
  color: white;
}

/* Responsive Design */
@media (max-width: 768px) {
  .group-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .form-row {
    flex-direction: column;
  }

  .subjects-grid {
    grid-template-columns: 1fr;
  }

  .modal-content {
    max-width: 95%;
  }

  .profiles-grid-modal {
    grid-template-columns: 1fr;
  }
}
</style>