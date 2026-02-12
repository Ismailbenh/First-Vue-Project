<script setup>
import { computed, ref, onMounted } from 'vue'
import Sidebar from '@/components/sidebar.vue'
import profileCotainer from '@/components/profile_requirement/profileCotainer.vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import { useRouter, useRoute } from 'vue-router'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import groupIcon from '@/components/icons/groupIcon.vue'
import GroupIconbig from '@/components/icons/groupIconbig.vue'
import editIcon from '@/components/icons/editIcon.vue'
import DeleteIcon from '@/components/icons/deleteIcon.vue'
import AddIcon from '@/components/icons/addIcon.vue'
import XIcon from '@/components/icons/xIcon.vue'
import SaveIcon from '@/components/icons/saveIcon.vue'
import LoopIcon from '@/components/icons/loopIcon.vue'
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
            if (detailResponse.ok) return await detailResponse.json()
            return { ...group, members: [] }
          } catch (error) {
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
  isLoadingAvailableProfiles.value = true
  availableProfilesForSelection.value = []
  try {
    const response = await fetch('http://localhost:3000/api/profiles/unassigned')
    
    if (response.status === 404) {
      console.warn('"/api/profiles/unassigned" returned 404 — falling back to client-side filtering.')
      
      const allResponse = await fetch('http://localhost:3000/api/profiles')
      if (!allResponse.ok) {
        throw new Error(`Failed to load profiles: ${allResponse.status}`)
      }
      const allProfiles = await allResponse.json()
      
      if (Array.isArray(allProfiles)) {
        availableProfilesForSelection.value = allProfiles.filter(p => !p.group_name && !p.group_id)
      } else {
        availableProfilesForSelection.value = []
      }
      return
    }

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`
      try {
        const errorBody = await response.json()
        errorMessage = errorBody.message || errorMessage
      } catch {
      }
      throw new Error(errorMessage)
    }
    
    const loadedProfiles = await response.json()
    availableProfilesForSelection.value = Array.isArray(loadedProfiles) ? loadedProfiles : []
  } catch (error) {
    console.error('Error loading available profiles:', error)
    availableProfilesForSelection.value = []
  } finally {
    isLoadingAvailableProfiles.value = false
  }
}

async function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (selectionMode.value) {
    selectedProfiles.value = []
    availableProfilesForSelection.value = []
    await loadAvailableProfilesForGroup()
  } else {
    selectedProfiles.value = []
    availableProfilesForSelection.value = []
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
      headers: { 'Content-Type': 'application/json' },
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
    const [groupDetailsRes, groupSubjectsRes, availableProfilesRes] = await Promise.all([
      fetch(`http://localhost:3000/api/groups/${group.id}`),
      fetch(`http://localhost:3000/api/groups/${group.id}/subjects`),
      fetch(`http://localhost:3000/api/profiles/available-for-group/${group.id}`)
    ])
    if (!groupDetailsRes.ok || !groupSubjectsRes.ok || !availableProfilesRes.ok) {
      throw new Error('Failed to load group data')
    }
    const groupDetails = await groupDetailsRes.json()
    const groupSubjects = await groupSubjectsRes.json()
    const availableProfiles = await availableProfilesRes.json()

    editingGroup.value = group
    editGroupName.value = groupDetails.name
    editGroupDescription.value = groupDetails.description || ''
    editSelectedSubjects.value = Array.isArray(groupSubjects) ? groupSubjects.map(s => s.id) : []
    editSelectedProfiles.value = Array.isArray(groupDetails.members) ? groupDetails.members.map(m => m.id) : []
    availableProfilesForSelection.value = Array.isArray(availableProfiles) ? availableProfiles : []
    isEditingGroup.value = true
  } catch (error) {
    console.error('Error loading group details:', error)
    alert('Failed to load group details')
  } finally {
    isLoadingAvailableProfiles.value = false
  }
}

async function saveEditedGroup() {
  if (!editGroupName.value.trim()) { alert('Please enter a group name'); return }
  if (editSelectedSubjects.value.length === 0) { alert('Please select at least one subject'); return }
  if (editSelectedProfiles.value.length === 0) { alert('Please select at least one member'); return }
  try {
    const response = await fetch(`http://localhost:3000/api/groups/${editingGroup.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
  isLoadingAvailableProfiles.value = false
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
    const response = await fetch(`http://localhost:3000/api/groups/${groupId}`, { method: 'DELETE' })
    const result = await response.json()
    if (result.success) {
      await loadProfileGroups()
    } else {
      alert(result.message || 'Failed to delete group')
    }
  } catch (error) {
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
  await Promise.all([loadProfileGroups(), loadSubjects()])
})
</script>

<template>
  <div class="app-container">
    <Sidebar />

    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />

      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">Groups Management</h1>
          <p class="page-subtitle">Organize profiles into groups and assign subjects</p>
        </div>
        <button
          @click="isCreatingGroup = !isCreatingGroup"
          class="create-group-btn"
          :class="{ 'create-group-btn--cancel': isCreatingGroup }"
        >
          <svg v-if="!isCreatingGroup" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          {{ isCreatingGroup ? 'Cancel' : 'New Group' }}
        </button>
      </header>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Groups</span>
            <groupIcon />
          </div>
          <div class="stat-value">{{ stats.totalGroups }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Members</span>
            <groupIcon />
          </div>
          <div class="stat-value">{{ stats.totalMembers }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Assigned to Rooms</span>
            
          </div>
          <div class="stat-value">{{ stats.assignedGroups }}</div>
        </div>
      </div>

      <transition name="slide-fade">
        <div v-if="isCreatingGroup" class="create-group-card">
          <div class="form-card-header">
            <h2 class="form-title">Create New Group</h2>
            <span class="form-step-badge">New</span>
          </div>

          <div class="form-section">
            <h3 class="section-label">Basic Information</h3>
            <div class="form-row">
              <div class="form-field">
                <label class="form-label">Group Name </label>
                <input v-model="newGroupName" placeholder="Enter group name" class="form-input" />
              </div>
              <div class="form-field">
                <label class="form-label">Description</label>
                <input v-model="newGroupDescription" placeholder="Optional description" class="form-input" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <h3 class="section-label">Subjects / Modules </h3>
            <div v-if="isLoadingSubjects" class="loading-inline">
              <div class="spinner-sm"></div> Loading subjects...
            </div>
            <div v-else class="checkbox-grid">
              <label
                v-for="subject in availableSubjects"
                :key="subject.id"
                class="checkbox-card"
                :class="{ selected: selectedSubjects.includes(subject.id) }"
              >
                <input type="checkbox" :value="subject.id" v-model="selectedSubjects" class="sr-only" />
                <svg v-if="selectedSubjects.includes(subject.id)" class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span class="checkbox-label">{{ subject.name }}</span>
              </label>
            </div>
            <p v-if="!isLoadingSubjects && selectedSubjects.length === 0" class="hint-text">Select at least one subject</p>
          </div>

          <div class="form-section">
            <div class="member-section-header">
              <div>
                <h3 class="section-label">Members </h3>
                <p class="section-sublabel">Select profiles to add to this group</p>
              </div>
              <button
                @click="toggleSelectionMode"
                class="toggle-btn"
                :class="{ 'toggle-btn--active': selectionMode }"
              >
                <svg v-if="!selectionMode" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <line x1="19" y1="8" x2="19" y2="14"></line>
                  <line x1="22" y1="11" x2="16" y2="11"></line>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                {{ selectionMode ? 'Cancel' : 'Browse Members' }}
              </button>
            </div>

            <transition name="fade">
              <div v-if="selectionMode">
                <div v-if="selectedProfiles.length > 0" class="selection-pill">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {{ selectedProfiles.length }} member{{ selectedProfiles.length !== 1 ? 's' : '' }} selected
                </div>

                <div v-if="isLoadingAvailableProfiles" class="empty-box">
                  <div class="spinner"></div>
                  <p>Loading available profiles...</p>
                </div>
                <div v-else-if="availableProfilesForSelection.length === 0" class="empty-box">
                  <groupIconbig />
                  <p>No unassigned profiles available.<br>All profiles are already in groups.</p>
                </div>
                <div v-else class="members-grid">
                  <profileCotainer
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
            </transition>
          </div>

          <div class="form-actions">
            <button @click="cancelGroupCreation" class="btn btn-ghost">Cancel</button>
            <button
              @click="createProfileGroup"
              class="btn btn-primary"
              :disabled="!newGroupName.trim() || selectedSubjects.length === 0 || selectedProfiles.length === 0"
            >
              Create Group
            </button>
          </div>
        </div>
      </transition>

      <div class="search-section">
        <div class="search-bar">
          <LoopIcon/>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search groups by name or description..."
            class="search-input"
          />
        </div>
      </div>

      <div class="groups-container">
        <div class="container-header">
          <h2 class="container-title">All Groups</h2>
          <p class="container-subtitle">Showing {{ filteredGroups.length }} of {{ profileGroups.length }} groups</p>
        </div>

        <div v-if="isLoadingGroups" class="loading-state">
          <div class="spinner"></div>
          <p>Loading groups...</p>
        </div>

        <div v-else-if="filteredGroups.length === 0" class="empty-state">
          <GroupIconbig />
          <h3>No groups found</h3>
          <p>{{ searchQuery ? 'Try adjusting your search' : 'Click "New Group" above to create your first group' }}</p>
        </div>

        <div v-else class="groups-grid">
          <div v-for="group in filteredGroups" :key="group.id" class="group-card">
            <div class="group-card-header">
              <div class="group-info">
                <div class="group-name-row">
                  <h3 class="group-name">{{ group.name }}</h3>
                  <span v-if="group.assignedRoom" class="room-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                    </svg>
                    {{ group.assignedRoom }}
                  </span>
                </div>
                <p v-if="group.description" class="group-description">{{ group.description }}</p>
              </div>
              <div class="group-card-actions">
                <span class="member-badge">
                  {{ group.memberCount || (group.members ? group.members.length : 0) }}
                  <span class="member-badge-label">members</span>
                </span>
                <button @click="openEditGroup(group)" class="icon-btn icon-btn-edit" title="Edit group">
                  <editIcon />
                </button>
                <button @click="deleteProfileGroup(group.id)" class="icon-btn icon-btn-delete" title="Delete group">
                  <DeleteIcon />
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
            
          </div>
        </div>
      </div>

      <transition name="modal-fade">
        <div v-if="isEditingGroup" class="modal-overlay" @click.self="closeEditGroup">
          <div class="modal-content">
            <div class="modal-header">
              <div>
                <h2 class="modal-title">Edit Group</h2>
                <p class="modal-subtitle">{{ editingGroup?.name }}</p>
              </div>
              <button @click="closeEditGroup" class="modal-close-btn">
                <XIcon/>
              </button>
            </div>

            <div class="modal-body">
              <div class="form-section">
                <label class="form-label">Group Name</label>
                <input v-model="editGroupName" class="form-input" placeholder="Enter group name" />
              </div>

              <div class="form-section">
                <label class="form-label">Description</label>
                <textarea v-model="editGroupDescription" class="form-textarea" rows="3" placeholder="Optional description"></textarea>
              </div>

              <div class="form-section">
                <label class="form-label">Subjects / Modules </label>
                <div class="checkbox-grid">
                  <label
                    v-for="subject in availableSubjects"
                    :key="subject.id"
                    class="checkbox-card"
                    :class="{ selected: editSelectedSubjects.includes(subject.id) }"
                  >
                    <input type="checkbox" :value="subject.id" v-model="editSelectedSubjects" class="sr-only" />
                    <svg v-if="editSelectedSubjects.includes(subject.id)" class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span class="checkbox-label">{{ subject.name }}</span>
                  </label>
                </div>
              </div>

              <div class="form-section">
                <label class="form-label">
                  Members 
                  <span class="count-badge">{{ editSelectedProfiles.length }} selected</span>
                </label>
                <div v-if="isLoadingAvailableProfiles" class="empty-box">
                  <div class="spinner"></div>
                  <p>Loading profiles...</p>
                </div>
                <div v-else-if="availableProfilesForSelection.length === 0" class="empty-box">
                  <p>No profiles available to add.</p>
                </div>
                <div v-else class="modal-members-grid">
                  <div
                    v-for="profile in availableProfilesForSelection"
                    :key="profile.id"
                    class="member-row"
                    :class="{ 'member-row--selected': editSelectedProfiles.includes(profile.id) }"
                    @click="handleEditProfileSelect(profile.id)"
                  >
                    <div class="member-avatar">
                      {{ profile.firstName?.charAt(0) }}{{ profile.lastName?.charAt(0) }}
                    </div>
                    <span class="member-name">{{ profile.firstName }} {{ profile.lastName }}</span>
                    <div class="member-check" :class="{ visible: editSelectedProfiles.includes(profile.id) }">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="closeEditGroup" class="btn btn-ghost">Cancel</button>
              <button @click="saveEditedGroup" class="btn btn-primary">
                <SaveIcon />
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

* { margin: 0; padding: 0; box-sizing: border-box; }

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

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin-bottom: 0.25rem;
}

.page-subtitle {
  font-size: 1rem;
  color: #64748b;
}



.create-group-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #1e293b;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.create-group-btn:hover {
  background: #334155;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.create-group-btn--cancel {
  background: #64748b;
}

.create-group-btn--cancel:hover {
  background: #475569;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
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
}

.stat-icon { color: #cbd5e1; }

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.create-group-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid #e2e8f0;
}

.form-card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.form-title {
  font-size: 1.35rem;
  font-weight: 600;
  color: #0f172a;
}

.form-step-badge {
  background: #dbeafe;
  color: #1e40af;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.form-section {
  margin-bottom: 2rem;
}

.section-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 1rem;
}

.section-sublabel {
  font-size: 0.85rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field { display: flex; flex-direction: column; }

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.required { color: #ef4444; }

.count-badge {
  font-size: 0.8rem;
  font-weight: 500;
  color: #3b82f6;
  background: #dbeafe;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
}

.form-input, .form-textarea {
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  transition: all 0.2s;
  font-family: inherit;
  background: white;
  width: 100%;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea { resize: vertical; min-height: 80px; }

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.6rem;
}

.checkbox-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.checkbox-card:hover {
  background: white;
  border-color: #cbd5e1;
}

.checkbox-card.selected {
  background: #eff6ff;
  border-color: #667eea;
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  border: 0;
}

.checkbox-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
}

.checkbox-card.selected .checkbox-label { color: #1e40af; }

.check-icon { color: #667eea; flex-shrink: 0; }

.hint-text {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #ef4444;
  font-style: italic;
}

.member-section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 7px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.toggle-btn:hover { background: #f8fafc; border-color: #cbd5e1; }

.toggle-btn--active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.toggle-btn--active:hover { background: #5568d3; border-color: #5568d3; }

.selection-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #d1fae5;
  color: #065f46;
  padding: 0.4rem 0.9rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.members-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 2rem;
  background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}

.empty-box svg { color: #cbd5e1; }

.loading-inline {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #64748b;
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 2rem;
  border-top: 1px solid #f1f5f9;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
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
  box-shadow: 0 4px 12px rgba(102,126,234,0.3);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  transform: none;
}

.btn-ghost {
  background: transparent;
  color: #64748b;
  border: 1.5px solid #e2e8f0;
}

.btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; color: #334155; }

.search-section { margin-bottom: 1.5rem; }

.search-bar {
  position: relative;
  max-width: 560px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
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
  box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
}

.groups-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.container-header {
  padding: 1.75rem 2rem;
  border-bottom: 1px solid #e2e8f0;
}

.container-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.container-subtitle { font-size: 0.875rem; color: #64748b; }

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  gap: 1rem;
  color: #64748b;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #64748b;
}

.empty-state svg { color: #cbd5e1; margin-bottom: 1rem; }
.empty-state h3 { font-size: 1.25rem; color: #334155; margin-bottom: 0.5rem; font-weight: 600; }

.groups-grid {
  display: flex;
  flex-direction: column;
  divide-y: 1px solid #f1f5f9;
}

.group-card {
  padding: 1.75rem 2rem;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s;
}

.group-card:last-child { border-bottom: none; }
.group-card:hover { background: #fafbfc; }

.group-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
  gap: 1rem;
}

.group-info { flex: 1; }

.group-name-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
  flex-wrap: wrap;
}

.group-name {
  font-size: 1.15rem;
  font-weight: 600;
  color: #0f172a;
}

.group-description { font-size: 0.875rem; color: #64748b; }

.room-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: #e0e7ff;
  color: #5b21b6;
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
}

.group-card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.member-badge {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  padding-right: 0.5rem;
}

.member-badge-label {
  font-size: 0.8rem;
  font-weight: 400;
  color: #64748b;
}

.icon-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
}

.icon-btn-edit { color: #3b82f6; }
.icon-btn-edit:hover { background: #eff6ff; border-color: #bfdbfe; }

.icon-btn-delete { color: #ef4444; }
.icon-btn-delete:hover { background: #fef2f2; border-color: #fecaca; }

.group-members {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.no-members {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #94a3b8;
  font-style: italic;
  padding: 0.5rem 0;
}

.spinner {
  width: 36px; height: 36px;
  border: 3px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 18px; height: 18px;
  border: 2px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 860px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 60px rgba(0,0,0,0.25);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.25rem;
}

.modal-subtitle { font-size: 0.9rem; color: #64748b; }

.modal-close-btn {
  width: 38px; height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.modal-close-btn:hover { background: #f8fafc; color: #0f172a; }

.modal-body { padding: 2rem; }

.modal-members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.5rem;
  max-height: 280px;
  overflow-y: auto;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.member-row:hover { border-color: #cbd5e1; background: #fafbfc; }

.member-row--selected {
  background: #eff6ff;
  border-color: #667eea;
}

.member-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.member-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-row--selected .member-name { color: #1e40af; }

.member-check {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #667eea;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.member-check.visible { opacity: 1; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.slide-fade-enter-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-fade-leave-active { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(-12px); opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .main-content { margin-left: 0; padding: 1.5rem; }
  .page-header { flex-direction: column; align-items: flex-start; }
  .page-title { font-size: 1.75rem; }
  .stats-grid { grid-template-columns: 1fr; }
  .form-row { grid-template-columns: 1fr; }
  .checkbox-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .group-card-header { flex-direction: column; }
  .modal-content { max-width: 95%; }
  .modal-members-grid { grid-template-columns: 1fr; }
}
</style>