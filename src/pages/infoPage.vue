<script setup>
// -------------------- Imports --------------------
import { computed, ref, onMounted } from 'vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import { useRouter, useRoute } from 'vue-router'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import textBox from '@/components/textBox.vue'
import Sidebar from '@/components/sidebar.vue'

// -------------------- Router + state setup --------------------
const avatarInputRef = ref(null)

const route = useRoute()
const router = useRouter()
const id = ref(route.params.id)
const isEditing = ref(false)
// Avatar/Profile Picture State
const avatarFile = ref(null)           // Selected file object
const avatarPreview = ref('')          // Preview URL for selected image
const currentAvatarUrl = ref('')       // Current avatar URL from server
const isUploadingAvatar = ref(false)   // Upload progress state
const avatarError = ref('')            // Error messages
const showAvatarUpload = ref(false)    // Toggle upload interface
// Profile state
const profile = ref({
    firstName: '',
    lastName: '',
    age: 18,
    professions: [],
    message: ''
})

// -------------------- Success message state --------------------
const successMessage = ref('')
const showSuccess = ref(false)

// -------------------- Profession options (now dynamic) --------------------
const professionsOptions = ref([])

// -------------------- Computed properties --------------------
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

// -------------------- Utility functions --------------------
const generateId = () => {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// -------------------- API functions --------------------
// -------------------- API functions --------------------
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
  <div class="layout">
    <Sidebar />
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      <div class="form-container">
        <!-- Success message -->
        <div v-if="showSuccess" class="success-message">
            {{ successMessage }}
        </div>
        
        <!-- Title changes based on editing or creating -->
        
        
        <!-- First name input -->
        <div class="form-group">
            <label for="firstName" class="name">
                First Name:
                <input 
                    id="firstName"
                    v-model="profile.firstName"
                    type="text" 
                    placeholder="Enter first name"
                >
            </label>
        </div>
        
        <!-- Last name input -->
        <div class="form-group">
            <label for="lastName" class="name">
                Last Name:
                <input 
                    id="lastName"
                    v-model="profile.lastName"
                    type="text" 
                    placeholder="Enter last name"
                >
            </label>
        </div>
        
        <!-- Age input -->
        <div class="form-group">
            <label for="age" class="age">
                Age:
                <input 
                    id="age"
                    v-model.number="profile.age"
                    type="number" 
                    min="0" 
                    max="100"
                    placeholder="Enter age"
                >
            </label>
        </div>
<!-- Profile Picture Section -->

<div class="form-group">
  <label class="avatar-label">Profile Picture:</label>
  
  <!-- Current/Preview Avatar Display -->
  <div class="avatar-display">
    <div class="avatar-container">
      <img 
        v-if="avatarPreview || currentAvatarUrl" 
        :src="avatarPreview || currentAvatarUrl" 
        alt="Profile picture"
        class="avatar-preview"
      />
      <div v-else class="avatar-placeholder">
        <span>No Image</span>
      </div>
    </div>
  </div>
  
  <!-- Upload Controls -->
  <div class="avatar-controls">
    <input
      ref="avatarInputRef"
      type="file"
      accept="image/*"
      @change="handleAvatarSelect"
      class="file-input"
      style="display: none;"
    />
    
    <CustomButton
      name="Choose Image"
      @click="triggerFileInput"
      class="choose-image-btn"
    />
    
    <CustomButton
      v-if="avatarPreview || currentAvatarUrl"
      name="Remove Image"
      @click="clearAvatar"
      class="remove-image-btn"
    />
  </div>
  
  <!-- Upload Progress -->
  <div v-if="isUploadingAvatar" class="upload-progress">
    Uploading image...
  </div>
  
  <!-- Error Display -->
  <div v-if="avatarError" class="avatar-error">
    {{ avatarError }}
  </div>
</div>
        <!-- Profession checkboxes -->
        <div class="form-group">
            <label class="profession-label">Profession:</label>
            <div class="checkbox-container">
                <div 
                    v-for="profession in professionsOptions" 
                    :key="profession" 
                    class="checkbox-item"
                >
                    <input 
                        :id="profession"
                        v-model="profile.professions"
                        :value="profession"
                        type="checkbox"
                        class="checkbox-input"
                    >
                    <label :for="profession" class="checkbox-label">
                        {{ profession }}
                    </label>
                </div>
            </div>
        </div>

        <!-- Profile preview -->
        <div class="preview" v-if="isProfileFilled">
  <h3>Profile Preview:</h3>
  
  <!-- Add avatar to preview -->
  <div v-if="avatarPreview || currentAvatarUrl" class="preview-avatar">
    <img :src="avatarPreview || currentAvatarUrl" alt="Profile picture" class="preview-avatar-img">
  </div>
  
  <p><strong>Name:</strong> {{ profile.firstName }} {{ profile.lastName }}</p>
  <p><strong>Age:</strong> {{ profile.age }}</p>
  <p><strong>Selected Professions:</strong> {{ profile.professions.join(', ') || 'None' }}</p>
  
  <textBox v-model="profile.message" class="textBox" />
  
  <CustomButton 
    :name="isEditing ? 'Update Profile' : 'Create Profile'" 
    @click="submitForm" 
    class="submit-btn" 
  />
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

/* Container */
.form-container {
    max-width: 500px;
    margin: 0 auto;
    padding: 10px;
    font-family: Arial, sans-serif;
}
.preview-avatar {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.preview-avatar-img {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #007bff;
}
/* Title */
.title {
    color: #F9F3EF;
    text-align: center;
    margin-bottom: 30px;
    font-size: 24px;
}

/* General form group styling */
.form-group {
    margin-bottom: 20px;
}

/* Labels */
.name, .age, .profession-label {
    display: block;
    font-weight: bold;
    margin-bottom: 8px;
    color: #F9F3EF;
}

/* Inputs for text/number */
.name input, .age input {
    display: block;
    width: 100%;
    padding: 10px;
    margin-top: 5px;
    border: 2px solid #ddd;
    border-radius: 5px;
    font-size: 16px;
    box-sizing: border-box;
}

/* Input focus */
.name input:focus, .age input:focus {
    outline: none;
    border-color: #007bff;
}

/* Checkbox grid */
.checkbox-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin-top: 10px;
}

/* Checkbox item styling */
.checkbox-item {
    display: flex;
    align-items: center;
    padding: 8px;
    border-radius: 5px;
    transition: background-color 0.2s;
}

.checkbox-item:hover {
    background-color: #000147;
}

/* Custom checkboxes */
.checkbox-input {
    margin-right: 8px;
    width: 16px;
    height: 16px;
    cursor: pointer;
}

/* Checkbox label */
.checkbox-label {
    cursor: pointer;
    color: #F9F3EF;
    font-size: 14px;
}

/* Profile preview box */
.preview {
    background-color: #f9f9f9;
    padding: 15px;
    border-radius: 8px;
    margin: 20px 0;
    border-left: 4px solid #007bff;
}

.preview h3 {
    margin-top: 0;
    color: #333;
}

.preview p {
    margin: 8px 0;
    color: #666;
}

/* Custom checkbox with ✓ */
.checkbox-input[type="checkbox"] {
    appearance: none;
    width: 18px;
    height: 18px;
    border: 2px solid #ddd;
    border-radius: 3px;
    background-color: white;
    position: relative;
    cursor: pointer;
}

.checkbox-input[type="checkbox"]:checked {
    background-color: #007bff;
    border-color: #007bff;
}

.checkbox-input[type="checkbox"]:checked::after {
    content: '✓';
    position: absolute;
    color: white;
    font-size: 12px;
    font-weight: bold;
    left: 2px;
    top: -1px;
}

/* Submit button */
.submit-btn {
    padding: 12px 24px;
    margin: 10px 5px 0 0;
    border: none;
    border-radius: 5px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s;
    background-color: #007bff;
    color: white;
}

.submit-btn:hover {
    background-color: #0056b3;
}
/* Avatar section styling */
.avatar-label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  color: #F9F3EF;
}

.avatar-display {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
}

.avatar-container {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #ddd;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #e9ecef;
  color: #6c757d;
  font-size: 12px;
}

.avatar-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 10px;
}

.choose-image-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.choose-image-btn:hover {
  background-color: #218838;
}

.remove-image-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.remove-image-btn:hover {
  background-color: #c82333;
}

.upload-progress {
  text-align: center;
  color: #007bff;
  font-weight: bold;
  padding: 8px;
}

.avatar-error {
  background-color: #f8d7da;
  color: #721c24;
  padding: 8px 12px;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
}
/* Success message styling */
.success-message {
    background-color: #d4edda;
    color: #155724;
    padding: 12px 16px;
    border: 1px solid #c3e6cb;
    border-radius: 5px;
    margin-bottom: 20px;
    font-weight: 500;
    animation: fadeIn 0.5s ease-in;
}

/* Fade-in animation */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
}

.textBox {
    border-color: black;
}
</style>