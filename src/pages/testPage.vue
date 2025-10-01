<template>
  <div class="test-page">
    <div class="header">
      <h1 class="page-title">User Dashboard</h1>
      <div class="user-info">
        <span class="user-email">{{ userEmail }}</span>
        <button @click="handleLogout" class="logout-btn">
          Logout
        </button>
      </div>
    </div>

    <div class="content">
      <!-- Loading State -->
      <div v-if="isLoadingProfile" class="loading-card">
        <p>Loading your profile...</p>
      </div>

      <!-- No Profile - Create One -->
      <div v-else-if="!userProfile" class="welcome-card">
        <h2>Welcome to Your Dashboard!</h2>
        <p>Create your profile to get started.</p>
        <button @click="showProfileForm = true" class="create-profile-btn">
          Create Your Profile
        </button>
      </div>

      <!-- Existing Profile Display -->
      <div v-else class="existing-profile-card">
        <h2>Your Profile</h2>
        <div class="profile-display">
          <div v-if="userProfile.avatarUrl" class="profile-avatar">
            <img 
              :src="userProfile.avatarUrl.startsWith('http') ? userProfile.avatarUrl : `http://localhost:3000/${userProfile.avatarUrl.replace(/^\/+/, '')}`"
              :alt="`${userProfile.firstName} ${userProfile.lastName}`"
              class="avatar-image"
            />
          </div>
          <div v-else class="avatar-placeholder">
            <span>{{ userProfile.firstName.charAt(0) }}{{ userProfile.lastName.charAt(0) }}</span>
          </div>

          <div class="profile-info">
            <h3>{{ userProfile.firstName }} {{ userProfile.lastName }}</h3>
            <p><strong>Age:</strong> {{ userProfile.age }}</p>
            <p><strong>Professions:</strong> {{ userProfile.professions ? userProfile.professions.join(', ') : 'None' }}</p>
            <p v-if="userProfile.message"><strong>Message:</strong> {{ userProfile.message }}</p>
            <p v-if="currentGroup"><strong>Current Group:</strong> <span class="group-badge">{{ currentGroup }}</span></p>
            <p v-else><strong>Current Group:</strong> <span class="no-group">Not assigned to any group</span></p>
          </div>
        </div>
      </div>

      <!-- Group Request Section -->
      <div v-if="userProfile" class="group-request-section">
        <h2>Group Management</h2>
        <div class="group-request-card">
          <h3>Request to Join or Change Group</h3>
          <p>Select a group you'd like to join or switch to. An admin will review your request.</p>
          
          <!-- Current Status -->
          <div class="current-status">
            <div class="status-item">
              <span class="status-label">Current Group:</span>
              <span v-if="currentGroup" class="current-group">{{ currentGroup }}</span>
              <span v-else class="no-group-text">Not in any group</span>
            </div>
            <div v-if="pendingRequest" class="status-item pending">
              <span class="status-label">Pending Request:</span>
              <span class="pending-group">{{ pendingRequest.groupName }}</span>
              <span class="pending-time">({{ formatRequestTime(pendingRequest.createdAt) }})</span>
            </div>
          </div>

          <!-- Group Selection Form -->
          <div v-if="!pendingRequest" class="request-form">
            <div class="form-group">
              <label for="groupSelect">Select Group:</label>
              <select 
                id="groupSelect" 
                v-model="selectedGroupId" 
                class="group-select"
                :disabled="isSubmittingRequest"
              >
                <option value="">Choose a group...</option>
                <option 
                  v-for="group in availableGroups" 
                  :key="group.id" 
                  :value="group.id"
                  :disabled="group.id === currentGroupId"
                >
                  {{ group.name }} ({{ group.memberCount || 0 }} members)
                  {{ group.id === currentGroupId ? ' - Current Group' : '' }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="requestMessage">Message (optional):</label>
              <textarea 
                id="requestMessage"
                v-model="requestMessage"
                placeholder="Explain why you want to join this group..."
                rows="3"
                class="request-textarea"
                :disabled="isSubmittingRequest"
              ></textarea>
            </div>

            <div class="form-actions">
              <button 
                @click="submitGroupRequest"
                :disabled="!selectedGroupId || isSubmittingRequest"
                class="submit-request-btn"
              >
                {{ isSubmittingRequest ? 'Submitting...' : 'Submit Request' }}
              </button>
            </div>
          </div>

          <!-- Pending Request Display -->
          <div v-else class="pending-request-display">
            <div class="pending-info">
              <div class="pending-icon"></div>
              <div class="pending-details">
                <h4>Request Pending</h4>
                <p>You have a pending request to join <strong>{{ pendingRequest.groupName }}</strong></p>
                <p class="pending-message" v-if="pendingRequest.message">
                  <em>"{{ pendingRequest.message }}"</em>
                </p>
                <p class="pending-time-full">Submitted {{ formatRequestTime(pendingRequest.createdAt) }}</p>
              </div>
            </div>
            <button 
              @click="cancelGroupRequest"
              class="cancel-request-btn"
              :disabled="isCancellingRequest"
            >
              {{ isCancellingRequest ? 'Cancelling...' : 'Cancel Request' }}
            </button>
          </div>

          <!-- Request History -->
          <div v-if="requestHistory.length > 0" class="request-history">
            <h4>Recent Requests</h4>
            <div class="history-list">
              <div 
                v-for="request in requestHistory.slice(0, 3)" 
                :key="request.id"
                class="history-item"
              >
                <div class="history-content">
                  <span class="history-group">{{ request.groupName }}</span>
                  <span :class="['history-status', request.resolution]">
                    {{ request.resolution === 'approved' ? 'Approved' : 'Denied' }}
                  </span>
                </div>
                <span class="history-time">{{ formatRequestTime(request.resolvedAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Profile Creation Form -->
      <div v-if="showProfileForm" class="profile-form-overlay">
        <div class="profile-form">
          <h3>Create Your Profile</h3>
          
          <!-- Avatar Upload -->
          <div class="form-group">
            <label class="avatar-label">Profile Picture:</label>
            <div class="avatar-upload">
              <div class="avatar-preview-container">
                <img v-if="avatarPreview" :src="avatarPreview" alt="Avatar preview" class="avatar-preview" />
                <div v-else class="avatar-placeholder-upload"> 
                  <!-- empty placeholder (no text) -->
                </div>
              </div>
              <input type="file" accept="image/*" @change="handleAvatarSelect" class="file-input" />
              <div v-if="avatarError" class="avatar-error">{{ avatarError }}</div>
            </div>
          </div>

          <!-- Name Fields -->
          <div class="form-group">
            <label for="firstName">First Name:</label>
            <input 
              id="firstName"
              v-model="profile.firstName"
              type="text" 
              placeholder="Enter first name"
              required
            />
          </div>

          <div class="form-group">
            <label for="lastName">Last Name:</label>
            <input 
              id="lastName"
              v-model="profile.lastName"
              type="text" 
              placeholder="Enter last name"
              required
            />
          </div>

          <!-- Age -->
          <div class="form-group">
            <label for="age">Age:</label>
            <input 
              id="age"
              v-model.number="profile.age"
              type="number" 
              min="0" 
              max="100"
            />
          </div>

          <!-- Professions -->
          <div class="form-group">
            <label class="profession-label">Professions:</label>
            <div class="checkbox-container">
              <div v-for="profession in professionsOptions" :key="profession" class="checkbox-item">
                <input 
                  :id="profession"
                  v-model="profile.professions"
                  :value="profession"
                  type="checkbox"
                />
                <label :for="profession">{{ profession }}</label>
              </div>
            </div>
          </div>

          <!-- Message -->
          <div class="form-group">
            <label for="message">Message (optional):</label>
            <textarea 
              id="message"
              v-model="profile.message"
              placeholder="Tell us about yourself..."
              rows="3"
            ></textarea>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button @click="createProfile" class="submit-btn" :disabled="isUploadingAvatar">
              {{ isUploadingAvatar ? 'Creating...' : 'Create Profile' }}
            </button>
            <button @click="showProfileForm = false" class="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'TestPage',
  setup() {
    const router = useRouter()
    const userEmail = ref('')
    const userId = ref('')
    const userProfile = ref(null)
    const showProfileForm = ref(false)
    const professionsOptions = ref([])
    const isLoadingProfile = ref(false)
    const avatarFile = ref(null)
    const avatarPreview = ref('')
    const avatarError = ref('')
    const isUploadingAvatar = ref(false)
    
    // Group request functionality
    const availableGroups = ref([])
    const currentGroup = ref('')
    const currentGroupId = ref('')
    const selectedGroupId = ref('')
    const requestMessage = ref('')
    const isSubmittingRequest = ref(false)
    const isCancellingRequest = ref(false)
    const pendingRequest = ref(null)
    const requestHistory = ref([])
    
    // Profile form data
    const profile = ref({
      firstName: '',
      lastName: '',
      age: 18,
      professions: [],
      message: ''
    })

    const generateId = () => {
      return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    }

    const fetchProfessions = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/professions')
        if (response.ok) {
          const professions = await response.json()
          professionsOptions.value = professions.map(p => p.name)
        }
      } catch (error) {
        console.error('Error fetching professions:', error)
        professionsOptions.value = ['Doctor', 'Software Engineer', 'Teacher', 'Electrician', 'Chef', 'Nurse']
      }
    }

    const loadUserProfile = async () => {
      if (!userId.value) return
      
      try {
        isLoadingProfile.value = true
        // Try fetching the richer profiles list (includes group_name/group_id)
        try {
          const listResp = await fetch('http://localhost:3000/api/profiles')
          if (listResp.ok) {
            const profiles = await listResp.json()
            const found = profiles.find(p => p.id === userId.value)
            if (found) {
              userProfile.value = found
              await setCurrentGroupFromProfile(found)
            } else {
              // Fallback to individual profile endpoint
              const response = await fetch(`http://localhost:3000/api/profiles/${userId.value}`)
              if (response.ok) {
                const profileData = await response.json()
                userProfile.value = profileData
                await setCurrentGroupFromProfile(profileData)
              }
            }
          } else {
            // Fallback if list fetch failed
            const response = await fetch(`http://localhost:3000/api/profiles/${userId.value}`)
            if (response.ok) {
              const profileData = await response.json()
              userProfile.value = profileData
              await setCurrentGroupFromProfile(profileData)
            }
          }
        } catch (err) {
          // On network error, fallback to single profile endpoint
          const response = await fetch(`http://localhost:3000/api/profiles/${userId.value}`)
          if (response.ok) {
            const profileData = await response.json()
            userProfile.value = profileData
            await setCurrentGroupFromProfile(profileData)
          }
        }
      } catch (error) {
        console.error('Error loading user profile:', error)
      } finally {
        isLoadingProfile.value = false
      }
    }

    const loadAvailableGroups = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/groups')
        if (response.ok) {
          const groups = await response.json()
          availableGroups.value = groups.filter(g => g && g.id && g.name)
          // If we already have a loaded profile, ensure current group name is updated
          if (userProfile.value) {
            await setCurrentGroupFromProfile(userProfile.value)
          }
        }
      } catch (error) {
        console.error('Error loading groups:', error)
      }
    }

    // Helper: given a profile object (from API), set currentGroup and currentGroupId
    const setCurrentGroupFromProfile = async (profileData) => {
      try {
        currentGroupId.value = profileData.group_id || ''
        // If API already gave us a name, prefer it
        if (profileData.group_name && profileData.group_name.trim()) {
          currentGroup.value = profileData.group_name
          return
        }

        // Try to resolve name from loaded groups
        const idToFind = profileData.group_id
        if (idToFind && availableGroups.value && availableGroups.value.length > 0) {
          const found = availableGroups.value.find(g => g.id === idToFind)
          if (found) {
            currentGroup.value = found.name
            return
          }
        }

        // As a fallback, fetch groups now and try again
        try {
          const resp = await fetch('http://localhost:3000/api/groups')
          if (resp.ok) {
            const groups = await resp.json()
            availableGroups.value = groups.filter(g => g && g.id && g.name)
            const found = availableGroups.value.find(g => g.id === idToFind)
            if (found) {
              currentGroup.value = found.name
              return
            }
          }
        } catch (e) {
          // ignore fetch errors here
        }

        // If nothing found, clear the display
        currentGroup.value = profileData.group_name || ''
      } catch (err) {
        console.error('Error resolving current group name:', err)
      }
    }

    const checkPendingRequests = async () => {
      if (!userId.value) return
      
      try {
        // This would be a custom endpoint to get user's notifications
        const response = await fetch(`http://localhost:3000/api/notifications?userId=${userId.value}&type=group_request`)
        if (response.ok) {
          const notifications = await response.json()
          
          // Find pending request
          const pending = notifications.find(n => !n.resolved && n.type === 'group_request')
          if (pending) {
            pendingRequest.value = {
              id: pending.id,
              groupName: pending.groupName,
              message: pending.message,
              createdAt: pending.createdAt
            }
          }
          
          // Get resolved requests for history
          const resolved = notifications
            .filter(n => n.resolved && n.type === 'group_request')
            .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))
          
          requestHistory.value = resolved.map(r => ({
            id: r.id,
            groupName: r.groupName,
            resolution: r.resolution,
            resolvedAt: r.resolvedAt
          }))
        }
      } catch (error) {
        console.error('Error checking pending requests:', error)
      }
    }

    const submitGroupRequest = async () => {
      if (!selectedGroupId.value || !userProfile.value) {
        alert('Please select a group')
        return
      }

      try {
        isSubmittingRequest.value = true
        
        const response = await fetch('http://localhost:3000/api/notifications/group-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profileId: userProfile.value.id,
            groupId: selectedGroupId.value,
            message: requestMessage.value.trim() || undefined
          })
        })

        const result = await response.json()

        if (result.success) {
          alert('Group request submitted successfully! An admin will review your request.')
          
          // Reset form
          selectedGroupId.value = ''
          requestMessage.value = ''
          
          // Refresh pending requests
          await checkPendingRequests()
        } else {
          alert('Error: ' + result.message)
        }
      } catch (error) {
        console.error('Error submitting group request:', error)
        alert('Network error. Please try again.')
      } finally {
        isSubmittingRequest.value = false
      }
    }

    const cancelGroupRequest = async () => {
      if (!pendingRequest.value || !confirm('Are you sure you want to cancel your group request?')) {
        return
      }

      try {
        isCancellingRequest.value = true
        
        const response = await fetch(`http://localhost:3000/api/notifications/${pendingRequest.value.id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          alert('Group request cancelled successfully.')
          pendingRequest.value = null
        } else {
          alert('Failed to cancel request. Please try again.')
        }
      } catch (error) {
        console.error('Error cancelling request:', error)
        alert('Network error. Please try again.')
      } finally {
        isCancellingRequest.value = false
      }
    }

    const formatRequestTime = (dateString) => {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      
      if (diffMins < 1) return 'just now'
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
      
      return date.toLocaleDateString()
    }

    const handleAvatarSelect = (event) => {
      const file = event.target.files[0]
      if (!file) return
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        avatarError.value = 'Please select a JPEG, PNG, WebP, or GIF image'
        return
      }
      
      if (file.size > 2 * 1024 * 1024) {
        avatarError.value = 'File size must be less than 2MB'
        return
      }
      
      avatarFile.value = file
      avatarError.value = ''
      
      const reader = new FileReader()
      reader.onload = (e) => {
        avatarPreview.value = e.target.result
      }
      reader.readAsDataURL(file)
    }

    const uploadAvatar = async (profileId) => {
      if (!avatarFile.value) return { success: true }
      
      const formData = new FormData()
      formData.append('avatar', avatarFile.value)
      
      try {
        isUploadingAvatar.value = true
        const response = await fetch(`http://localhost:3000/api/profiles/${profileId}/avatar`, {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
          const result = await response.json()
          return { success: true, avatarUrl: result.avatarUrl }
        }
        return { success: false }
      } catch (error) {
        console.error('Avatar upload error:', error)
        return { success: false }
      } finally {
        isUploadingAvatar.value = false
      }
    }

    const createProfile = async () => {
      if (!profile.value.firstName.trim() || !profile.value.lastName.trim()) {
        alert('First name and last name are required')
        return
      }

      if (!profile.value.professions || profile.value.professions.length === 0) {
        alert('Please select at least one profession')
        return
      }

      try {
        const profileId = userId.value || generateId()
        
        const profileData = {
          id: profileId,
          firstName: profile.value.firstName.trim(),
          lastName: profile.value.lastName.trim(),
          age: profile.value.age,
          professions: profile.value.professions,
          message: profile.value.message?.trim() || '',
          avatarUrl: null
        }

        const response = await fetch('http://localhost:3000/api/addProfile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileData)
        })

        const result = await response.json()

        if (result.success) {
          // Upload avatar if selected
          if (avatarFile.value) {
            await uploadAvatar(profileId)
          }

          // Update the user record to link with this profile
          await linkUserToProfile(profileId)
          
          alert('Profile created successfully!')
          showProfileForm.value = false
          await loadUserProfile()
          await loadAvailableGroups()
        } else {
          alert('Error: ' + result.message)
        }
      } catch (error) {
        console.error('Error creating profile:', error)
        alert('Network error. Please try again.')
      }
    }

    const linkUserToProfile = async (profileId) => {
      try {
        await fetch(`http://localhost:3000/api/users/${userId.value}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId })
        })
      } catch (error) {
        console.error('Error linking user to profile:', error)
      }
    }

    const handleLogout = () => {
      localStorage.removeItem('isAuthenticated')
      localStorage.removeItem('userEmail')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      router.push('/login')
    }

    onMounted(async () => {
      userEmail.value = localStorage.getItem('userEmail') || 'Unknown'
      userId.value = localStorage.getItem('userId') || ''
      
      await fetchProfessions()
      await loadUserProfile()
      
      if (userProfile.value) {
        await loadAvailableGroups()
        await checkPendingRequests()
      }
    })

    return {
      userEmail,
      userId,
      userProfile,
      showProfileForm,
      professionsOptions,
      isLoadingProfile,
      avatarFile,
      avatarPreview,
      avatarError,
      isUploadingAvatar,
      profile,
      availableGroups,
      currentGroup,
      currentGroupId,
      selectedGroupId,
      requestMessage,
      isSubmittingRequest,
      isCancellingRequest,
      pendingRequest,
      requestHistory,
      handleAvatarSelect,
      createProfile,
      handleLogout,
      submitGroupRequest,
      cancelGroupRequest,
      formatRequestTime
    }
  }
}
</script>

<style scoped>
/* Existing styles... */
.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  color: #F9F3EF;
  font-size: 0.9rem;
}

.loading-card {
  background: #234a66;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
}

.create-profile-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.create-profile-btn:hover {
  background: #218838;
}

.existing-profile-card {
  background: #234a66;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-bottom: 2rem;
}

.profile-display {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.profile-avatar {
  width: 120px;
  height: 120px;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #ddd;
}

.avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #3A6B85;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  color: white;
}

.profile-info h3 {
  color: #ffffff;
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
}

.group-badge {
  background: #007bff;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}

.no-group {
  color: #adb5bd;
  font-style: italic;
}

/* Group Request Section Styles */
.group-request-section {
  background: #234a66;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-bottom: 2rem;
}

.group-request-section h2 {
  color: #ffffff;
  margin: 0 0 1rem 0;
  font-size: 1.8rem;
}

.group-request-card {
  background: #1B3C53;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #3A6B85;
}

.group-request-card h3 {
  color: #ffffff;
  margin: 0 0 0.5rem 0;
  font-size: 1.3rem;
}

.group-request-card p {
  color: #F9F3EF;
  margin-bottom: 1.5rem;
}

.current-status {
  background: rgba(255, 255, 255, 0.05);
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-item.pending {
  color: #ffc107;
}

.status-label {
  font-weight: bold;
  color: #F9F3EF;
}

.current-group {
  background: #007bff;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
}

.no-group-text {
  color: #adb5bd;
  font-style: italic;
}

.pending-group {
  background: #ffc107;
  color: #212529;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: bold;
}

.pending-time {
  font-size: 0.8rem;
  color: #adb5bd;
}

.request-form .form-group {
  margin-bottom: 1rem;
}

.request-form label {
  display: block;
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: #F9F3EF;
}

.group-select,
.request-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #3A6B85;
  border-radius: 4px;
  background: #234a66;
  color: #F9F3EF;
  font-size: 1rem;
}

.group-select:disabled,
.request-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-request-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-request-btn:hover:not(:disabled) {
  background: #218838;
}

.submit-request-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.pending-request-display {
  text-align: center;
  padding: 2rem;
}

.pending-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.pending-icon {
  font-size: 2rem;
}

.pending-details h4 {
  color: #ffffff;
  margin: 0 0 0.5rem 0;
}

.pending-details p {
  color: #F9F3EF;
  margin: 0.25rem 0;
}

.pending-message {
  color: #adb5bd !important;
  font-size: 0.9rem;
}

.pending-time-full {
  color: #adb5bd !important;
  font-size: 0.8rem;
}

.cancel-request-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-request-btn:hover:not(:disabled) {
  background: #c82333;
}

.cancel-request-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.request-history {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #3A6B85;
}

.request-history h4 {
  color: #ffffff;
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.history-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.history-group {
  color: #F9F3EF;
  font-weight: 500;
}

.history-status {
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: bold;
}

.history-status.approved {
  background: #28a745;
  color: white;
}

.history-status.denied {
  background: #dc3545;
  color: white;
}

.history-time {
  color: #adb5bd;
  font-size: 0.8rem;
}

.profile-form-overlay {
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
}

.profile-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.checkbox-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.avatar-preview-container {
  width: 100px;
  height: 100px;
}

.avatar-preview {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ddd;
}

.avatar-placeholder-upload {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 2px dashed #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 0.8rem;
}

.avatar-error {
  color: #dc3545;
  font-size: 0.8rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.submit-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
}

.submit-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.cancel-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
}

.test-page {
  min-height: 100vh;
  background: #1B3C53;
  color: #F9F3EF;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #3A6B85;
}

.page-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #ffffff;
  margin: 0;
}

.logout-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background: #c82333;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  background: #234a66;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-bottom: 2rem;
  text-align: center;
}

.welcome-card h2 {
  color: #ffffff;
  font-size: 2rem;
  margin-bottom: 1rem;
}

.welcome-card p {
  color: #F9F3EF;
  font-size: 1.1rem;
  margin: 0.5rem 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .profile-display {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .pending-info {
    flex-direction: column;
    text-align: center;
  }
  
  .history-item {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .history-content {
    justify-content: space-between;
    width: 100%;
  }
}
</style>