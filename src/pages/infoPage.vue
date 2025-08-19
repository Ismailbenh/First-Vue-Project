<script setup>
// -------------------- Imports --------------------
import { computed, ref, onMounted } from 'vue'           // Vue reactivity + lifecycle
import CustomButton from '@/components/profile_requirement/button.vue' // Reusable button
import { useRouter, useRoute } from 'vue-router'         // Router utilities
import profilesData from '@/data/profiles.json'          // Static data (local JSON)
import Breadcrumbs from '@/components/Breadcrumbs.vue'
import textBox from '@/components/textBox.vue'
// -------------------- Router + state setup --------------------
const route = useRoute()         // Get info about current route
const router = useRouter()       // Navigate between pages
const id = route.params.id       // Get profile ID from route (if editing)
const isEditing = ref(false)     // Whether form is in edit mode

// Profile state (bound to form fields)
const profile = ref({
    firstName: '',
    lastName: '',
    age: 18,
    professions: [],
    message:''              // Multiple professions selected via checkboxes
})

// -------------------- Success message state --------------------
const successMessage = ref('')   // Message shown after profile saved
const showSuccess = ref(false)   // Controls whether message is visible

// -------------------- Profession options for checkboxes --------------------
const professionsOptions = [
    'doctor',
    'Software Engineer',
    'Teacher',
    'Electrician',
    'chef',
    'nurse'
]

// -------------------- Computed property: check if form has any data --------------------
const isProfileFilled = computed(() => {
    return profile.value.firstName || 
           profile.value.lastName || 
           profile.value.age !== 18 || 
           (profile.value.professions?.length > 0)
})

// -------------------- Lifecycle: run when component mounts --------------------
onMounted(() => {
    if (id) {
        isEditing.value = true   // If ID exists → we’re editing
        const existing = profilesData.find(p => p.id == id) // Find matching profile
        if (existing) {
            // Deep clone the found profile into reactive form state
            profile.value = JSON.parse(JSON.stringify(existing))
        }
    }
})

// -------------------- Utility: generate unique profile ID --------------------
const generateId = () => {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// -------------------- Function: write profile to backend API --------------------
const writeToProfileJson = async (profileData) => {
    // Decide URL + HTTP method depending on editing or creating
    const url = isEditing.value 
        ? `http://localhost:3000/api/updateProfile/${id}` 
        : 'http://localhost:3000/api/addProfile'

    const method = isEditing.value ? 'PUT' : 'POST'

    try {
        console.log('Sending to:', url, 'with method:', method)
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        })

        console.log('Response status:', response.status)
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        console.log('Result:', result)
        return { success: result.success, data: result.profile || profileData }
    } catch (error) {
        console.error('Error saving profile:', error)
        return { success: false }
    }
}

// -------------------- Communicate updates globally --------------------
// Dispatches a global event so the profile list page can update without reload
const updateProfilesGlobal = (profileData) => {
    window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { profile: profileData, isEditing: isEditing.value, id: id } 
    }))
}

// -------------------- Form submission --------------------
const submitForm = async () => {
    // Basic validation
    if (!profile.value.firstName.trim()) {
        alert('Please enter a first name')
        return
    }
    if (!profile.value.lastName.trim()) {
        alert('Please enter a last name')
        return
    }
    
    // Construct profile object to send
    const profileData = {
        id: isEditing.value ? id : generateId(), // Reuse ID if editing, new ID if creating
        firstName: profile.value.firstName.trim(),
        lastName: profile.value.lastName.trim(),
        age: profile.value.age,
        professions: profile.value.professions.filter(prof => prof !== ''),
        message: profile.value.message.trim() // Include message if provided
    }
    
    console.log('Profile Data:', profileData)
    
    // Send profile to backend
    const result = await writeToProfileJson(profileData)

    if (result.success) {
        // Success message
        successMessage.value = isEditing.value 
            ? `Profile updated for ${profileData.firstName} ${profileData.lastName}!`
            : `Profile created for ${profileData.firstName} ${profileData.lastName}!`
        showSuccess.value = true
        
        // Update other components via global event
        updateProfilesGlobal(result.data || profileData)
        
        // Hide success message after 2 seconds & return to profile page
        setTimeout(() => {
            showSuccess.value = false
            router.push({ name: 'profilePage' })
        }, 2000)
    } else {
        alert('Error saving profile. Please try again.')
    }
}
// Add this computed property after your other computed properties
const breadcrumbs = computed(() => {
  const baseBreadcrumbs = [
    { label: 'Home', route: { name: 'profilePage' } }
  ]
  
  if (isEditing.value && profile.value.firstName && profile.value.lastName) {
    // When editing: Home / John Doe / Edit Profile
    baseBreadcrumbs.push(
    { label: 'InfoPage', route: null },
    { label: `${profile.value.firstName} ${profile.value.lastName}`, route: null },
        
    )
  } else {
    // When creating: Home / Add New Profile
    baseBreadcrumbs.push({
      label: 'Add New Profile',
      route: null
    })
  }
  
  return baseBreadcrumbs
})
</script>

<!-- -------------------- Template: UI Layout -------------------- -->
<template>
<Breadcrumbs :breadcrumbs="breadcrumbs" />
    <div class="form-container">
        
        <!-- Success message -->
        <div v-if="showSuccess" class="success-message">
            {{ successMessage }}
        </div>
        
        <!-- Title changes based on editing or creating -->
        <h1 class="title">{{ isEditing ? 'Edit Profile' : 'Add New Profile' }}</h1>
        
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

        <!-- Profile preview (only if some data entered) -->
        <div class="preview" v-if="isProfileFilled">
            <h3>Profile Preview:</h3>
            <p><strong>Name:</strong> {{ profile.firstName }} {{ profile.lastName }}</p>
            <p><strong>Age:</strong> {{ profile.age }}</p>
            <p><strong>Selected Professions:</strong> {{ profile.professions.join(', ') || 'None' }}</p>
            <textBox v-model="profile.message" class="textBox" />
            <!-- Submit button (text changes depending on editing/creating) -->
            <CustomButton 
                :name="isEditing ? 'Update Profile' : 'Create Profile'" 
                @click="submitForm" 
                class="submit-btn" />
        </div>
        
        
    </div>
</template>

<!-- -------------------- Styles -------------------- -->
<style scoped>
/* Container */
.form-container {
    max-width: 500px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
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