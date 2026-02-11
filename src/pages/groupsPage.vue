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
  { label: 'Groups', route: null }
]

// Data state
const profiles = ref([])
const profileGroups = ref([])
const rooms = ref([])
const availableSubjects = ref([])
const availableProfilesForSelection = ref([])

// Form state
const newGroupName = ref('')
const newGroupDescription = ref('')
const selectedSubjects = ref([])
const selectedProfiles = ref([])

// UI state
const isCreatingGroup = ref(false)
const selectionMode = ref(false)
const isLoadingGroups = ref(false)
const isLoadingSubjects = ref(false)
const isLoadingAvailableProfiles = ref(false)
const searchQuery = ref('')

// Edit group modal state
const isEditingGroup = ref(false)
const editingGroup = ref(null)
const editGroupName = ref('')
const editGroupDescription = ref('')
const editSelectedSubjects = ref([])
const editSelectedProfiles = ref([])

// Statistics
const stats = computed(() => ({
  totalGroups: profileGroups.value.length,
  totalMembers: profileGroups.value.reduce((sum, g) => sum + (g.memberCount || 0), 0),
  assignedGroups: profileGroups.value.filter(g => g.assignedRoom).length
}))

// Filtered groups based on search
const filteredGroups = computed(() => {
  if (!searchQuery.value) return profileGroups.value
  
  const search = searchQuery.value.toLowerCase()
  return profileGroups.value.filter(g => 
    g.name.toLowerCase().includes(search) ||
    (g.description && g.description.toLowerCase().includes(search))
  )
})

// API functions
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
    availableProfilesForSelection.value = loadedProfiles
  } catch (error) {
    console.error('Error loading available profiles:', error)
    availableProfilesForSelection.value = []
  }
}

async function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (selectionMode.value) {
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
    })

    const result = await response.json()

    if (result.success) {
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

async function openEditGroup(group) {
  try {
    isLoadingAvailableProfiles.value = true
    
    const [groupDetails, groupSubjects, availableProfiles] = await Promise.all([
      fetch(`http://localhost:3000/api/groups/${group.id}`).then(r => r.json()),
      fetch(`http://localhost:3000/api/groups/${group.id}/subjects`).then(r => r.json()),
      fetch(`http://localhost:3000/api/profiles/available-for-group/${group.id}`).then(r => r.json())
    ])

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
    })

    const result = await response.json()

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

function closeEditGroup() {
  isEditingGroup.value = false
  editingGroup.value = null
  editGroupName.value = ''
  editGroupDescription.value = ''
  editSelectedSubjects.value = []
  editSelectedProfiles.value = []
  availableProfilesForSelection.value = []
}

function handleEditProfileSelect(profileId) {
  const index = editSelectedProfiles.value.indexOf(profileId)
  if (index > -1) {
    editSelectedProfiles.value.splice(index, 1)
  } else {
    editSelectedProfiles.value.push(profileId)
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
      await loadProfileGroups()
    } else {
      alert(result.message || 'Failed to delete group')
    }
  } catch (error) {
    console.error('Error deleting group:', error)
    alert('Error deleting group. Please try again.')
  }
}

function cancelGroupCreation() {
  isCreatingGroup.value = false
  selectionMode.value = false
  newGroupName.value = ''
  newGroupDescription.value = ''
  selectedProfiles.value = []
  selectedSubjects.value = []
}

onMounted(async () => {
  await Promise.all([
    loadProfileGroups(),
    loadSubjects()
  ])
})
</script>

<template>
  <div class="app-container">
    <Sidebar />
    
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      
      <!-- Header -->
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">Groups Management</h1>
          <p class="page-subtitle">Organize profiles into groups and assign <span class="highlight">subjects</span></p>
        </div>
        <button 
          @click="isCreatingGroup = !isCreatingGroup"
          class="create-group-btn"
        >
          <svg v-if="!isCreatingGroup" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          {{ isCreatingGroup ? 'Cancel' : 'Create New Group' }}
        </button>
      </header>
      
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Groups</span>
            <svg class="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="stat-value">{{ stats.totalGroups }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Members</span>
            <svg class="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="stat-value">{{ stats.totalMembers }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Assigned to Rooms</span>
            <svg class="stat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <div class="stat-value">{{ stats.assignedGroups }}</div>
        </div>
      </div>

      <!-- Create Group Form -->
      <transition name="slide-fade">
        <div v-if="isCreatingGroup" class="create-group-card">
          <h2 class="form-title">Create New Group</h2>
          
          <!-- Basic Information -->
          <div class="form-section">
            <div class="form-row">
              <div class="form-field">
                <label class="form-label">Group Name *</label>
                <input 
                  v-model="newGroupName" 
                  placeholder="Enter group name" 
                  class="form-input"
                />
              </div>
              <div class="form-field">
                <label class="form-label">Description</label>
                <input 
                  v-model="newGroupDescription" 
                  placeholder="Optional description" 
                  class="form-input"
                />
              </div>
            </div>
          </div>

          <!-- Subject Selection -->
          <div class="form-section">
            <label class="form-label">Select Subjects/Modules *</label>
            <div v-if="isLoadingSubjects" class="loading-message">Loading subjects...</div>
            <div v-else class="subjects-grid">
              <label 
                v-for="subject in availableSubjects" 
                :key="subject.id"
                class="checkbox-card"
                :class="{ selected: selectedSubjects.includes(subject.id) }"
              >
                <input 
                  type="checkbox" 
                  :value="subject.id"
                  v-model="selectedSubjects"
                  class="checkbox-input"
                />
                <span class="checkbox-label">{{ subject.name }}</span>
                <svg v-if="selectedSubjects.includes(subject.id)" class="check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </label>
            </div>
            <p v-if="selectedSubjects.length === 0" class="hint-text">
              Please select at least one subject
            </p>
          </div>

          <!-- Member Selection -->
          <div class="form-section">
            <div class="member-header">
              <label class="form-label">Select Members *</label>
              <button 
                @click="toggleSelectionMode"
                class="toggle-selection-btn"
                :class="{ active: selectionMode }"
              >
                {{ selectionMode ? 'Cancel Selection' : 'Add Members' }}
              </button>
            </div>
            
            <div v-if="selectionMode" class="selection-info">
              <span class="selected-count">{{ selectedProfiles.length }} member(s) selected</span>
            </div>

            <transition name="fade">
              <div v-if="selectionMode" class="members-grid">
                <div v-if="isLoadingAvailableProfiles" class="loading-message">
                  Loading available profiles...
                </div>
                <div v-else-if="availableProfilesForSelection.length === 0" class="empty-message">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <p>No available profiles. All profiles are already assigned to groups.</p>
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
            </transition>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button @click="cancelGroupCreation" class="btn-secondary">
              Cancel
            </button>
            <button 
              @click="createProfileGroup" 
              class="btn-primary"
              :disabled="!newGroupName.trim() || selectedSubjects.length === 0 || selectedProfiles.length === 0"
            >
              Create Group
            </button>
          </div>
        </div>
      </transition>

      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-bar">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search groups by name or description..."
            class="search-input"
          />
        </div>
      </div>

      <!-- Groups List -->
      <div class="groups-container">
        <div class="groups-header">
          <h2 class="section-title">All Groups</h2>
          <p class="section-subtitle">Showing {{ filteredGroups.length }} of {{ profileGroups.length }} groups</p>
        </div>

        <div v-if="isLoadingGroups" class="loading-state">
          <div class="spinner"></div>
          <p>Loading groups...</p>
        </div>

        <div v-else-if="filteredGroups.length === 0" class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <h3>No groups found</h3>
          <p>{{ searchQuery ? 'Try adjusting your search' : 'Create your first group to get started' }}</p>
        </div>

        <div v-else class="groups-grid">
          <div v-for="group in filteredGroups" :key="group.id" class="group-card">
            <div class="group-card-header">
              <div class="group-title-section">
                <h3 class="group-name">{{ group.name }}</h3>
                <p v-if="group.description" class="group-description">{{ group.description }}</p>
                <span v-if="group.assignedRoom" class="room-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                  </svg>
                  {{ group.assignedRoom }}
                </span>
              </div>
              <div class="group-actions">
                <span class="member-count">
                  {{ group.memberCount || (group.members ? group.members.length : 0) }}
                  <span class="member-label">members</span>
                </span>
                <button @click="openEditGroup(group)" class="action-btn edit-btn" title="Edit group">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button @click="deleteProfileGroup(group.id)" class="action-btn delete-btn" title="Delete group">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="group.members && group.members.length > 0" class="group-members">
              <profileCotainer
                v-for="profile in group.members"
                :key="profile.id"
                :id="profile.id"
                :firstName="profile.firstName"
                :last-name="profile.lastName"
                :is-selectable="false"
                :is-selected="false"
              />
            </div>
            <div v-else class="no-members">
              <p>No members in this group</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Group Modal -->
      <transition name="modal-fade">
        <div v-if="isEditingGroup" class="modal-overlay" @click.self="closeEditGroup">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title">Edit Group: {{ editingGroup.name }}</h2>
              <button @click="closeEditGroup" class="modal-close-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div class="modal-body">
              <!-- Basic Info -->
              <div class="form-section">
                <label class="form-label">Group Name *</label>
                <input v-model="editGroupName" class="form-input" />
              </div>

              <div class="form-section">
                <label class="form-label">Description</label>
                <textarea v-model="editGroupDescription" class="form-textarea" rows="3"></textarea>
              </div>

              <!-- Subjects -->
              <div class="form-section">
                <label class="form-label">Subjects/Modules *</label>
                <div class="subjects-grid">
                  <label 
                    v-for="subject in availableSubjects" 
                    :key="subject.id"
                    class="checkbox-card"
                    :class="{ selected: editSelectedSubjects.includes(subject.id) }"
                  >
                    <input 
                      type="checkbox" 
                      :value="subject.id"
                      v-model="editSelectedSubjects"
                      class="checkbox-input"
                    />
                    <span class="checkbox-label">{{ subject.name }}</span>
                    <svg v-if="editSelectedSubjects.includes(subject.id)" class="check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </label>
                </div>
              </div>

              <!-- Members -->
              <div class="form-section">
                <label class="form-label">Members * ({{ editSelectedProfiles.length }} selected)</label>
                <div v-if="isLoadingAvailableProfiles" class="loading-message">
                  Loading available profiles...
                </div>
                <div v-else-if="availableProfilesForSelection.length === 0" class="empty-message">
                  <p>No available profiles to add.</p>
                </div>
                <div v-else class="modal-members-grid">
                  <div
                    v-for="profile in availableProfilesForSelection"
                    :key="profile.id"
                    class="member-checkbox-item"
                    :class="{ selected: editSelectedProfiles.includes(profile.id) }"
                    @click="handleEditProfileSelect(profile.id)"
                  >
                    <input 
                      type="checkbox" 
                      :checked="editSelectedProfiles.includes(profile.id)"
                      @click.stop="handleEditProfileSelect(profile.id)"
                      class="checkbox-input"
                    />
                    <span class="member-name">{{ profile.firstName }} {{ profile.lastName }}</span>
                    <svg v-if="editSelectedProfiles.includes(profile.id)" class="check-icon-small" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="closeEditGroup" class="btn-secondary">
                Cancel
              </button>
              <button @click="saveEditedGroup" class="btn-primary">
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

.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 500;
}

.create-group-btn {
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

.create-group-btn:hover {
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

/* Create Group Card */
.create-group-card {
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

.form-input,
.form-textarea {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  transition: all 0.2s;
  font-family: inherit;
  background: white;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

/* Subjects Grid */
.subjects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.checkbox-card {
  position: relative;
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

.checkbox-card:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.checkbox-card.selected {
  background: #eff6ff;
  border-color: #667eea;
}

.checkbox-input {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: #667eea;
}

.checkbox-label {
  flex: 1;
  font-size: 0.9rem;
  color: #334155;
  font-weight: 500;
}

.check-icon {
  color: #667eea;
}

.hint-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #ef4444;
  font-style: italic;
}

/* Member Selection */
.member-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.toggle-selection-btn {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-selection-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.toggle-selection-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.selection-info {
  padding: 0.75rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.selected-count {
  font-size: 0.875rem;
  color: #1e40af;
  font-weight: 600;
}

.members-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.loading-message,
.empty-message {
  padding: 3rem;
  text-align: center;
  color: #64748b;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}

.empty-message svg {
  color: #cbd5e1;
  margin-bottom: 1rem;
}

.empty-message p {
  margin-top: 0.5rem;
  font-size: 0.9rem;
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

/* Groups Container */
.groups-container {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.groups-header {
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

/* Groups Grid */
.groups-grid {
  display: grid;
  gap: 1.5rem;
}

.group-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  background: #fafbfc;
  transition: all 0.2s;
}

.group-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #cbd5e1;
}

.group-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.group-title-section {
  flex: 1;
}

.group-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.group-description {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.room-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #e0e7ff;
  color: #5b21b6;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.member-count {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.member-label {
  font-size: 0.8rem;
  font-weight: 400;
  color: #64748b;
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

.group-members {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.no-members {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  font-style: italic;
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
  max-width: 900px;
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

.modal-members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 8px;
}

.member-checkbox-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.member-checkbox-item:hover {
  border-color: #cbd5e1;
}

.member-checkbox-item.selected {
  background: #eff6ff;
  border-color: #667eea;
}

.member-name {
  flex: 1;
  font-size: 0.875rem;
  color: #334155;
  font-weight: 500;
}

.check-icon-small {
  color: #667eea;
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

  .subjects-grid {
    grid-template-columns: 1fr;
  }

  .group-card-header {
    flex-direction: column;
    gap: 1rem;
  }

  .modal-content {
    max-width: 95%;
  }

  .modal-members-grid {
    grid-template-columns: 1fr;
  }
}
</style>