<script setup>
// -------------------- Imports --------------------
import { computed, ref, onMounted } from 'vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import { useRouter, useRoute } from 'vue-router'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import textBox from '@/components/textBox.vue'
import Sidebar from '@/components/sidebar.vue'

const avatarInputRef = ref(null)

const route = useRoute()
const router = useRouter()
const id = ref(route.params.id)
const isEditing = ref(false)
const avatarFile = ref(null)          
const avatarPreview = ref('')          
const currentAvatarUrl = ref('')      
const isUploadingAvatar = ref(false)   
const avatarError = ref('')            
const showAvatarUpload = ref(false)   
const profile = ref({
    firstName: '',
    lastName: '',
    age: 18,
    professions: [],
    message: ''
})

const successMessage = ref('')
const showSuccess = ref(false)

const professionsOptions = ref([])

const isProfileFilled = computed(() => {
    return profile.value.firstName || 
           profile.value.lastName || 
           profile.value.age !== 18 || 
           (profile.value.professions?.length > 0)
})

const breadcrumbs = computed(() => {
  const baseBreadcrumbs = [
    { label: 'Home', route: { name: 'profilePage' } }
  ]
  
  if (isEditing.value && profile.value.firstName && profile.value.lastName) {
    baseBreadcrumbs.push(
    { label: 'InfoPage', route: null },
    { label: `${profile.value.firstName} ${profile.value.lastName}`, route: null },
    )
  } else {
    baseBreadcrumbs.push({
      label: 'Add New Profile',
      route: null
    })
  }
  
  return baseBreadcrumbs
})

const generateId = () => {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}


const fetchProfessions = async () => {
    try {
        console.log('Fetching professions from API...') // Debug log
        const response = await fetch('http://localhost:3000/api/professions')
        console.log('Response status:', response.status) // Debug log
        
        if (response.ok) {
            const professions = await response.json()
            console.log('Raw professions data:', professions) // Debug log
            
            // Handle the response properly - extract name from each profession object
            professionsOptions.value = professions.map(p => p.name)
            console.log('Processed professions:', professionsOptions.value) // Debug log
        } else {
            console.error('Failed to fetch professions. Status:', response.status)
            // Fallback to default professions if API fails
            professionsOptions.value = ['Doctor', 'Software Engineer', 'Teacher', 'Electrician', 'Chef', 'Nurse']
        }
    } catch (error) {
        console.error('Error fetching professions:', error)
        // Fallback to default professions if network error
        professionsOptions.value = ['Doctor', 'Software Engineer', 'Teacher', 'Electrician', 'Chef', 'Nurse']
    }
}

const writeToProfileJson = async (profileData) => {
    const url = isEditing.value 
        ? `http://localhost:3000/api/profiles/${id.value}`
        : 'http://localhost:3000/api/addProfile'

    const method = isEditing.value ? 'PUT' : 'POST'

    try {
        console.log(`${method} ${url}`, profileData)
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        })
        
        const result = await response.json()
        
        if (!response.ok) {
            console.error('Server error:', result)
            throw new Error(result.message || `Server error: ${response.status}`)
        }
        
        if (!result.success) {
            throw new Error(result.message || 'Operation failed')
        }
        
        return { success: true, data: result.profile || profileData }
        
    } catch (error) {
        console.error('Error saving profile:', error)
        return { success: false, error: error.message }
    }
}
const triggerFileInput = () => {
  if (avatarInputRef.value) {
    avatarInputRef.value.click()
  }
}
// -------------------- Form submission --------------------
const submitForm = async () => {
  // Validation
  if (!profile.value.firstName.trim()) {
    alert('First name is required')
    return
  }
  
  if (!profile.value.lastName.trim()) {
    alert('Last name is required')
    return
  }

  if (!profile.value.professions || profile.value.professions.length === 0) {
    alert('Please select at least one profession')
    return
  }

  try {
    // Generate/get profile ID
    const profileId = isEditing.value ? id.value : generateId()
    
    // Prepare profile data (without avatar initially)
    const profileData = {
      id: profileId,
      firstName: profile.value.firstName.trim(),
      lastName: profile.value.lastName.trim(),
      age: profile.value.age,
      professions: Array.isArray(profile.value.professions) 
        ? profile.value.professions.filter(prof => prof !== '') 
        : [],
      message: profile.value.message?.trim() || '',
      avatarUrl: currentAvatarUrl.value || null // Keep existing avatar URL if editing
    }

    console.log('Submitting profile data:', profileData)

    // STEP 1: Create/update the profile first
    const result = await writeToProfileJson(profileData)
    
    if (!result.success) {
      alert('Error: ' + (result.error || 'Failed to save profile'))
      return
    }

    // STEP 2: Upload avatar AFTER profile exists (only if new image selected)
    if (avatarFile.value) {
      console.log('Uploading avatar for profile ID:', profileId)
      const uploadResult = await uploadAvatar(profileId)
      
      if (uploadResult.success) {
        console.log('Avatar uploaded successfully:', uploadResult.avatarUrl)
        // Profile is already created, avatar URL will be updated by the server
      } else {
        console.warn('Avatar upload failed, but profile was saved successfully')
        // Don't fail the entire operation if avatar fails
      }
    }

    // Success
    successMessage.value = isEditing.value 
      ? 'Profile updated successfully!' 
      : 'Profile created successfully!'
    showSuccess.value = true
    
    setTimeout(() => {
      showSuccess.value = false
      router.push({ name: 'profilePage' })
    }, 2000)

  } catch (error) {
    console.error('Submission error:', error)
    alert('Network error. Please check if the server is running.')
  }
}
const handleAvatarSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // Enhanced validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    avatarError.value = 'Please select a JPEG, PNG, WebP, or GIF image'
    return
  }
  
  // Size limit (2MB recommended for avatars)
  if (file.size > 2 * 1024 * 1024) {
    avatarError.value = 'File size must be less than 2MB'
    return
  }
  
  avatarFile.value = file
  avatarError.value = ''
  
  // Create preview with error handling
  const reader = new FileReader()
  reader.onload = (e) => {
    avatarPreview.value = e.target.result
  }
  reader.onerror = () => {
    avatarError.value = 'Failed to read file'
  }
  reader.readAsDataURL(file)
}
// Your current approach - enhance it:
const uploadAvatar = async (targetProfileId = null) => {
  if (!avatarFile.value) return { success: false }
  
  // Use provided profileId or fall back to current id
  const profileId = targetProfileId || id.value
  
  if (!profileId) {
    console.error('No profile ID available for avatar upload')
    return { success: false, error: 'Profile ID required' }
  }
  
  const formData = new FormData()
  formData.append('avatar', avatarFile.value)
  formData.append('userId', profileId)
  formData.append('timestamp', Date.now())
  
  try {
    isUploadingAvatar.value = true
    
    console.log(`Uploading to: /api/profiles/${profileId}/avatar`)
    
    const response = await fetch(`http://localhost:3000/api/profiles/${profileId}/avatar`, {
      method: 'POST',
      body: formData
    })
    
    console.log('Upload response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upload failed:', errorText)
      throw new Error(`Upload failed: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    console.log('Upload successful:', result)
    
    // Update current avatar URL
    currentAvatarUrl.value = result.avatarUrl
    
    return { success: true, avatarUrl: result.avatarUrl }
    
  } catch (error) {
    console.error('Avatar upload error:', error)
    avatarError.value = 'Failed to upload image: ' + error.message
    return { success: false, error: error.message }
  } finally {
    isUploadingAvatar.value = false
  }
}
const clearAvatar = () => {
  avatarFile.value = null
  avatarPreview.value = ''
  avatarError.value = ''
  // Reset file input
  const fileInput = document.querySelector('#avatar-input')
  if (fileInput) fileInput.value = ''
}

// -------------------- Lifecycle --------------------
// Fixed avatar loading logic for the Vue component
onMounted(async () => {
  console.log('Component mounted')
  console.log('Route params ID:', route.params.id)
  console.log('ID ref value:', id.value)
  
  try {
    // Always fetch professions first
    console.log('Fetching professions...')
    await fetchProfessions()
    console.log('After fetchProfessions, options:', professionsOptions.value)
    
    // Check if we're in editing mode
    if (id.value) {
      console.log('Editing mode - ID:', id.value)
      isEditing.value = true
      
      try {
        console.log('Fetching existing profile data...')
        const response = await fetch(`http://localhost:3000/api/profiles/${id.value}`)
        console.log('Profile fetch response status:', response.status)
        
        if (response.ok) {
          const existing = await response.json()
          console.log('Raw profile data received:', existing)
          
          // Handle professions array properly
          if (existing.professions) {
            if (Array.isArray(existing.professions) && existing.professions.length > 0 && existing.professions[0].name) {
              existing.professions = existing.professions.map(p => p.name)
            } else if (!Array.isArray(existing.professions)) {
              existing.professions = existing.professions ? [existing.professions] : []
            }
          } else {
            existing.professions = []
          }
          
          // CRITICAL: Handle avatar URL properly
          console.log('Avatar URL from database:', existing.avatarUrl)
          
          if (existing.avatarUrl) {
            // Make sure the URL is properly formatted
            let avatarUrl = existing.avatarUrl
            
            // If the URL doesn't start with http, prepend the server URL
            if (!avatarUrl.startsWith('http')) {
              // Remove leading slash if present to avoid double slashes
              if (avatarUrl.startsWith('/')) {
                avatarUrl = avatarUrl.substring(1)
              }
              avatarUrl = `http://localhost:3000/${avatarUrl}`
            }
            
            console.log('Processed avatar URL:', avatarUrl)
            currentAvatarUrl.value = avatarUrl
            
            // Verify avatar file exists on server
            try {
              const avatarCheckResponse = await fetch(avatarUrl, { method: 'HEAD' })
              console.log('Avatar file check status:', avatarCheckResponse.status)
              
              if (!avatarCheckResponse.ok) {
                console.warn('Avatar file not accessible, clearing URL')
                currentAvatarUrl.value = ''
              } else {
                console.log('Avatar file verified successfully')
              }
            } catch (avatarError) {
              console.warn('Could not verify avatar file existence:', avatarError)
              // Keep the URL anyway, let the img element handle the error
            }
          } else {
            console.log('No avatar URL found in profile data')
            currentAvatarUrl.value = ''
          }
          
          // Clear any preview since we're loading existing data
          avatarPreview.value = ''
          avatarFile.value = null
          avatarError.value = ''
          
          // Set the profile data
          console.log('Setting profile data:', existing)
          profile.value = {
            firstName: existing.firstName || '',
            lastName: existing.lastName || '',
            age: existing.age || 18,
            professions: existing.professions || [],
            message: existing.message || ''
          }
          
          console.log('Profile successfully loaded for editing')
          console.log('Final currentAvatarUrl:', currentAvatarUrl.value)
          
        } else if (response.status === 404) {
          console.error('Profile not found (404)')
          alert('Profile not found!')
          router.push({ name: 'profilePage' })
          return
        } else {
          console.error('Failed to fetch profile, status:', response.status)
          const errorText = await response.text()
          console.error('Error response:', errorText)
          alert('Error loading profile data!')
          router.push({ name: 'profilePage' })
          return
        }
        
      } catch (profileError) {
        console.error('Network error loading profile:', profileError)
        alert('Network error loading profile! Please check if the server is running.')
        router.push({ name: 'profilePage' })
        return
      }
      
    } else {
      console.log('Create new profile mode')
      isEditing.value = false
      
      // Initialize empty profile for creation
      profile.value = {
        firstName: '',
        lastName: '',
        age: 18,
        professions: [],
        message: ''
      }
      
      // Clear any avatar state
      currentAvatarUrl.value = ''
      avatarPreview.value = ''
      avatarFile.value = null
      avatarError.value = ''
      
      console.log('Profile initialized for creation')
    }
    
  } catch (generalError) {
    console.error('General error in onMounted:', generalError)
    alert('An error occurred while initializing the page!')
  }
  
  console.log('onMounted completed successfully')
  console.log('Final profile state:', profile.value)
  console.log('Final isEditing state:', isEditing.value)
  console.log('Final currentAvatarUrl state:', currentAvatarUrl.value)
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
          <h1 class="page-title">{{ isEditing ? 'Edit Profile' : 'Create New Profile' }}</h1>
          <p class="page-subtitle">
            {{ isEditing ? 'Update profile information and settings' : 'Add a new user profile to the system' }}
          </p>
        </div>
      </header>
      
      <!-- Success message -->
      <div v-if="showSuccess" class="success-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        {{ successMessage }}
      </div>
      
      <div class="form-card">
        <!-- Avatar Section -->
        <div class="form-section">
          <h3 class="section-title">Profile Picture</h3>
          <div class="avatar-section">
            <div class="avatar-display">
              <div class="avatar-circle">
                <img 
                  v-if="avatarPreview || currentAvatarUrl" 
                  :src="avatarPreview || currentAvatarUrl" 
                  alt="Profile picture"
                  class="avatar-image"
                />
                <div v-else class="avatar-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
              </div>
            </div>
            
            <div class="avatar-controls">
              <input
                ref="avatarInputRef"
                type="file"
                accept="image/*"
                @change="handleAvatarSelect"
                style="display: none;"
              />
              
              <button @click="triggerFileInput" class="btn btn-secondary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Choose Image
              </button>
              
              <button
                v-if="avatarPreview || currentAvatarUrl"
                @click="clearAvatar"
                class="btn btn-ghost"
              >
                Remove
              </button>
            </div>
            
            <p class="avatar-hint">JPG, PNG, WebP or GIF. Max size 2MB.</p>
            
            <div v-if="isUploadingAvatar" class="upload-status">
              <div class="spinner"></div>
              Uploading image...
            </div>
            
            <div v-if="avatarError" class="error-message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {{ avatarError }}
            </div>
          </div>
        </div>
        
        <!-- Basic Information -->
        <div class="form-section">
          <h3 class="section-title">Basic Information</h3>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="firstName" class="form-label">First Name</label>
              <input 
                id="firstName"
                v-model="profile.firstName"
                type="text" 
                placeholder="Enter first name"
                class="form-input"
              >
            </div>
            
            <div class="form-group">
              <label for="lastName" class="form-label">Last Name</label>
              <input 
                id="lastName"
                v-model="profile.lastName"
                type="text" 
                placeholder="Enter last name"
                class="form-input"
              >
            </div>
          </div>
          
          <div class="form-group">
            <label for="age" class="form-label">Age</label>
            <input 
              id="age"
              v-model.number="profile.age"
              type="number" 
              min="0" 
              max="100"
              placeholder="Enter age"
              class="form-input"
              style="max-width: 200px;"
            >
          </div>
        </div>
        
        <!-- Professions -->
        <div class="form-section">
          <h3 class="section-title">Profession</h3>
          <div class="checkbox-grid">
            <label 
              v-for="profession in professionsOptions" 
              :key="profession" 
              class="checkbox-card"
            >
              <input 
                :id="profession"
                v-model="profile.professions"
                :value="profession"
                type="checkbox"
                class="checkbox-input"
              >
              <span class="checkbox-label">{{ profession }}</span>
              <svg class="checkbox-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </label>
          </div>
        </div>
        
        <!-- Profile Preview -->
        <div v-if="isProfileFilled" class="preview-section">
          <h3 class="section-title">Profile Preview</h3>
          
          <div class="preview-card">
            <div v-if="avatarPreview || currentAvatarUrl" class="preview-avatar">
              <img :src="avatarPreview || currentAvatarUrl" alt="Profile picture">
            </div>
            
            <div class="preview-content">
              <div class="preview-row">
                <span class="preview-label">Name:</span>
                <span class="preview-value">{{ profile.firstName }} {{ profile.lastName }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Age:</span>
                <span class="preview-value">{{ profile.age }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Professions:</span>
                <span class="preview-value">{{ profile.professions.join(', ') || 'None' }}</span>
              </div>
            </div>
            
            <textBox v-model="profile.message" class="preview-message" />
            
            <button @click="submitForm" class="btn btn-primary btn-large">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              {{ isEditing ? 'Update Profile' : 'Create Profile' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Import modern font */
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
  max-width: 1400px;
}

/* Header */
.page-header {
  margin-bottom: 2rem;
}

.header-content {
  max-width: 800px;
}

.page-title {
  font-size: 2rem;
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

/* Success Banner */
.success-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #d1fae5;
  color: #065f46;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 1px solid #a7f3d0;
  font-weight: 500;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Form Card */
.form-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

/* Form Section */
.form-section {
  padding: 2rem;
  border-bottom: 1px solid #f1f5f9;
}

.form-section:last-child {
  border-bottom: none;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 1.5rem;
}

/* Avatar Section */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.avatar-display {
  margin-bottom: 0.5rem;
}

.avatar-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  color: #cbd5e1;
}

.avatar-controls {
  display: flex;
  gap: 0.75rem;
}

.avatar-hint {
  font-size: 0.875rem;
  color: #64748b;
  text-align: center;
}

.upload-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #3b82f6;
  font-size: 0.875rem;
  font-weight: 500;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #dbeafe;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fef2f2;
  color: #991b1b;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  border: 1px solid #fecaca;
}

/* Form Elements */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  letter-spacing: 0.01em;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #0f172a;
  transition: all 0.2s;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input::placeholder {
  color: #cbd5e1;
}

/* Checkbox Grid */
.checkbox-grid {
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
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8fafc;
}

.checkbox-card:hover {
  background: white;
  border-color: #cbd5e1;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.checkbox-input:checked + .checkbox-label {
  color: #3b82f6;
  font-weight: 600;
}

.checkbox-input:checked ~ .checkbox-icon {
  opacity: 1;
  color: #3b82f6;
}

.checkbox-card:has(.checkbox-input:checked) {
  background: #eff6ff;
  border-color: #3b82f6;
}

.checkbox-label {
  flex: 1;
  font-size: 0.9rem;
  color: #334155;
  transition: all 0.2s;
}

.checkbox-icon {
  opacity: 0;
  transition: opacity 0.2s;
}

/* Preview Section */
.preview-section {
  background: #f8fafc;
  padding: 2rem;
}

.preview-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  border: 1px solid #e2e8f0;
}

.preview-avatar {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.preview-avatar img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #e2e8f0;
}

.preview-content {
  margin-bottom: 1.5rem;
}

.preview-row {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.preview-row:last-child {
  border-bottom: none;
}

.preview-label {
  font-weight: 600;
  color: #64748b;
  min-width: 120px;
  font-size: 0.9rem;
}

.preview-value {
  color: #0f172a;
  font-size: 0.9rem;
}

.preview-message {
  margin-bottom: 1.5rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-family: inherit;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-secondary {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: white;
  border-color: #cbd5e1;
}

.btn-ghost {
  background: transparent;
  color: #64748b;
  border: 1px solid transparent;
}

.btn-ghost:hover {
  background: #f8fafc;
  color: #334155;
}

.btn-large {
  padding: 0.875rem 2rem;
  font-size: 1rem;
  width: 100%;
}

/* Responsive */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    padding: 1.5rem;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .form-section {
    padding: 1.5rem;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .checkbox-grid {
    grid-template-columns: 1fr;
  }
}
</style>