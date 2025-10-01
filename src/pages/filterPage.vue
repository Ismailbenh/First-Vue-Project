<script setup>
import { computed, ref, onMounted } from 'vue'
import profileContainer from '@/components/profile_requirement/profileCotainer.vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import { useRouter } from 'vue-router'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import Sidebar from '@/components/sidebar.vue'

// -------------------- Router setup --------------------
const router = useRouter()

// -------------------- State --------------------
const profiles = ref([])
const selectedProfessions = ref([])
const filteredProfiles = ref([])
const isLoading = ref(false)
const professionsOptions = ref([])

// -------------------- Computed properties --------------------
const breadcrumb = computed(() => [
  { label: 'Home', route: { name: 'profilePage' } },
  { label: 'Filter by Jobs', route: null }
])

const hasFilters = computed(() => selectedProfessions.value.length > 0)

const filteredCount = computed(() => filteredProfiles.value.length)

const totalProfilesCount = computed(() => profiles.value.length)

// -------------------- API functions --------------------
const fetchProfessions = async () => {
    try {
        console.log('Fetching professions from API...')
        const response = await fetch('http://localhost:3000/api/professions')
        console.log('Response status:', response.status)
        
        if (response.ok) {
            const professions = await response.json()
            console.log('Raw professions data:', professions)
            
            // Handle the response properly - extract name from each profession object
            professionsOptions.value = professions.map(p => p.name)
            console.log('Processed professions:', professionsOptions.value)
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

async function loadProfiles() {
  try {
    isLoading.value = true
    console.log('Loading profiles for filtering...')
    
    const response = await fetch('http://localhost:3000/api/profiles')
    if (response.ok) {
      const apiProfiles = await response.json()
      
      // Fetch professions for each profile
      const profilesWithProfessions = await Promise.all(
        apiProfiles.map(async (profile) => {
          try {
            const profResponse = await fetch(`http://localhost:3000/api/profiles/${profile.id}`)
            if (profResponse.ok) {
              const fullProfile = await profResponse.json()
              return {
                ...profile,
                professions: fullProfile.professions || []
              }
            }
            return {
              ...profile,
              professions: []
            }
          } catch (error) {
            console.error(`Error fetching professions for profile ${profile.id}:`, error)
            return {
              ...profile,
              professions: []
            }
          }
        })
      )
      
      profiles.value = profilesWithProfessions
      console.log(`Loaded ${profilesWithProfessions.length} profiles with professions`)
      
      // Apply initial filter if any professions are selected
      if (selectedProfessions.value.length > 0) {
        applyFilter()
      } else {
        filteredProfiles.value = profilesWithProfessions
      }
    } else {
      console.error('Failed to fetch profiles')
    }
  } catch (error) {
    console.error('Error fetching profiles:', error)
  } finally {
    isLoading.value = false
  }
}

// -------------------- Filter functions --------------------
function applyFilter() {
  if (selectedProfessions.value.length === 0) {
    filteredProfiles.value = profiles.value
    return
  }

  filteredProfiles.value = profiles.value.filter(profile => {
    // Handle the new profession array format
    const profileProfessions = Array.isArray(profile.professions) 
      ? profile.professions 
      : []

    // Check if profile has ALL of the selected professions (AND logic)
    return selectedProfessions.value.every(selectedProf => 
      profileProfessions.includes(selectedProf)
    )
  })

  console.log(`Filter applied: ${filteredProfiles.value.length} profiles match ALL criteria`)
}

function clearFilters() {
  selectedProfessions.value = []
  filteredProfiles.value = profiles.value
}

function toggleProfession(profession) {
  const index = selectedProfessions.value.indexOf(profession)
  if (index > -1) {
    selectedProfessions.value.splice(index, 1)
  } else {
    selectedProfessions.value.push(profession)
  }
  applyFilter()
}

// -------------------- Profile actions --------------------
function editProfile(id) {
  console.log('Editing profile with id:', id)
  router.push({ name: 'infoPage', params: { id } })
}

async function deleteProfile(id) {
  if (!confirm('Are you sure you want to delete this profile?')) {
    return
  }

  try {
    const response = await fetch(`http://localhost:3000/api/profiles/${id}`, {
      method: 'DELETE',
    })

    const result = await response.json()

    if (result.success) {
      // Remove from both arrays
      profiles.value = profiles.value.filter(p => p.id !== id)
      filteredProfiles.value = filteredProfiles.value.filter(p => p.id !== id)
      console.log('Profile deleted successfully')
    } else {
      alert('Failed to delete profile: ' + (result.message || 'Unknown error'))
    }
  } catch (error) {
    console.error('Error deleting profile:', error)
    alert('Error deleting profile. Please try again.')
  }
}

// -------------------- Utility functions --------------------
function getProfessionDisplayText(professions) {
  if (!professions || !Array.isArray(professions)) return 'No professions'
  return professions.length > 0 ? professions.join(', ') : 'No professions'
}

// -------------------- Lifecycle --------------------
onMounted(async () => {
  await fetchProfessions()
  await loadProfiles()
})
</script>

<template>
  <div class="layout">
    <Sidebar />
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumb" />
      <h1 class="title">Filter Profiles by Jobs</h1>
      
      <!-- Filter Controls -->
      <div class="filter-section">
        <h2 class="filter-title">Select Professions to Filter:</h2>
        
        <!-- Profession Checkboxes -->
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
              >
              <span class="checkbox-label">{{ profession }}</span>
            </label>
          </div>
        </div>

        <!-- Filter Actions -->
        <div class="filter-actions">
          <CustomButton 
            v-if="hasFilters"
            name="Clear All Filters" 
            @click="clearFilters"
            class="clear-filters-btn"
          />
          <div class="filter-info">
            <span v-if="hasFilters" class="results-count">
              Showing {{ filteredCount }} of {{ totalProfilesCount }} profiles
            </span>
            <span v-else class="results-count">
              Showing all {{ totalProfilesCount }} profiles
            </span>
          </div>
        </div>

        <!-- Active Filters Display -->
        <div v-if="selectedProfessions.length > 0" class="active-filters">
          <h3>Active Filters:</h3>
          <div class="filter-tags">
            <span 
              v-for="profession in selectedProfessions" 
              :key="profession"
              class="filter-tag"
            >
              {{ profession }}
              <button 
                @click="toggleProfession(profession)"
                class="remove-filter"
                title="Remove filter"
              >
                ×
              </button>
            </span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading">
        <p>Loading profiles...</p>
      </div>

      <!-- Results Section -->
      <div v-else class="results-section">
        <h2 class="results-title">
          {{ hasFilters ? 'Filtered Results' : 'All Profiles' }}
        </h2>
        
        <!-- No Results -->
        <div v-if="filteredProfiles.length === 0 && !isLoading" class="no-results">
          <p v-if="hasFilters">
            No profiles found with the selected professions. 
            Try selecting different professions or clearing the filters.
          </p>
          <p v-else>No profiles found.</p>
        </div>

        <!-- Profiles List -->
        <div v-else class="profiles-grid">
          <div 
            v-for="profile in filteredProfiles" 
            :key="profile.id"
            class="profile-card"
          >
            <profileContainer
              :id="profile.id"
              :firstName="profile.firstName"
              :last-name="profile.lastName"
              @edit="() => editProfile(profile.id)"
              @delete="deleteProfile"
            >
              <template #actions>
                <div class="profile-details">
                  <div class="profile-info">
                    <p><strong>Age:</strong> {{ profile.age }}</p>
                    <p><strong>Professions:</strong> {{ getProfessionDisplayText(profile.professions) }}</p>
                    <p v-if="profile.room_name" class="room-info">
                      <span class="room-badge">Room: {{ profile.room_name }}</span>
                    </p>
                    <p v-if="profile.group_name" class="group-info">
                      <span class="group-badge">Group: {{ profile.group_name }}</span>
                    </p>
                  </div>
                  <div class="profile-actions">
                    <CustomButton name="Edit" @click="editProfile(profile.id)" />
                    <CustomButton name="Delete" @click="deleteProfile(profile.id)" />
                  </div>
                </div>
              </template>
            </profileContainer>
          </div>
        </div>
      </div>

      <!-- Quick Navigation -->
      <div class="quick-nav">
        <CustomButton 
          name="Back to All Profiles" 
          @click="router.push({ name: 'profilePage' })"
          class="nav-btn"
        />
        <CustomButton 
          name="Add New Profile" 
          @click="router.push({ name: 'infoPage' })"
          class="nav-btn"
        />
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

.title {
  color: #F9F3EF;
  text-align: center;
  margin-bottom: 30px;
  font-size: 24px;
}

.filter-section {
  background: #2C5F7A;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
  border: 1px solid #3A6B85;
}

.filter-title {
  margin-bottom: 15px;
  color: #F9F3EF;
  font-size: 1.2em;
}

.profession-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}

.profession-filter-item {
  margin-bottom: 8px;
}

.profession-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.profession-checkbox:hover {
  background-color: #1B3C53;
}

.checkbox-input {
  margin-right: 8px;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-label {
  font-weight: 500;
  color: #F9F3EF;
}

.filter-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 15px;
}

.filter-info {
  font-weight: bold;
  color: #F9F3EF;
}

.results-count {
  font-size: 0.95em;
}

.active-filters {
  border-top: 1px solid #3A6B85;
  padding-top: 15px;
}

.active-filters h3 {
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
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 0.85em;
  font-weight: 500;
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

.results-section {
  margin-bottom: 30px;
}

.results-title {
  margin-bottom: 20px;
  color: #F9F3EF;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #F9F3EF;
}

.no-results {
  text-align: center;
  padding: 40px;
  background: #2C5F7A;
  border-radius: 8px;
  color: #F9F3EF;
  border: 1px solid #3A6B85;
}

.profiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.profile-card {
  border: 1px solid #3A6B85;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  background: #2C5F7A;
}

.profile-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.profile-details {
  padding: 15px;
}

.profile-info {
  margin-bottom: 15px;
}

.profile-info p {
  margin: 8px 0;
  color: #F9F3EF;
}

.profile-info strong {
  color: #F9F3EF;
}

.room-badge, .group-badge {
  background: #17a2b8;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 500;
}

.group-badge {
  background: #28a745;
}

.profile-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.quick-nav {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
  padding-top: 20px;
  border-top: 1px solid #3A6B85;
}

.nav-btn {
  min-width: 150px;
}

.clear-filters-btn {
  background-color: #dc3545;
  border-color: #dc3545;
}

.clear-filters-btn:hover {
  background-color: #c82333;
  border-color: #bd2130;
}

@media (max-width: 768px) {
  .profession-filters {
    grid-template-columns: 1fr;
  }
  
  .filter-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .quick-nav {
    flex-direction: column;
  }
  
  .nav-btn {
    width: 100%;
  }
}
</style>