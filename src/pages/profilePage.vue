<script setup>
import { computed, ref } from 'vue'
import profileCotainer from '@/components/profile_requirement/profileCotainer.vue'
import CustomButton from '@/components/profile_requirement/button.vue'
import AddIcon from '@/components/icons/addIcon.vue'
import { useRouter } from 'vue-router'
import profilesData from '@/data/profiles.json'
import Breadcrumbs from '@/components/Breadcrumbs.vue'

const breadcrumb = computed(() => [
  { label: 'Home', route: { name: 'profilePage' } }
])

const profiles = ref(profilesData)
const router = useRouter()

// -------------------- Computed: Filter profiles that have messages --------------------
const profilesWithMessages = computed(() => {
  return profiles.value.filter(profile => profile.message && profile.message.trim() !== '')
})

function handleAddButton() {
  router.push({ name: 'infoPage' })
}

function editProfile(id) {
  console.log('Editing profile with id:', id)
  router.push({ name: 'infoPage', params: { id } })
}
</script>

<template>
  <Breadcrumbs :breadcrumbs="breadcrumb" />
  <h1 class="title">My website</h1>
  <h2 class="title">Profiles:</h2>
  
  <!-- -------------------- Profile Cards (without messages) -------------------- -->
  <div class="profiles">
    <profileCotainer
      v-for="profile in profiles"
      :key="profile.id"
      :id="profile.id"
      :firstName="profile.firstName"
      :last-name="profile.lastName"
      @edit="editProfile"
    />
   
    <CustomButton :icon="AddIcon" @click="handleAddButton" class="addbutton" />
  </div>

  <!-- -------------------- Messages Section -------------------- -->
  <div v-if="profilesWithMessages.length > 0" class="messages-section">
    <h2 class="messages-title">Messages:</h2>
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
</template>

<style scoped>
.profiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.addbutton {
  padding: 24px;
  height: 191px;
}

.title {
  margin: 10px 0;
}

/* -------------------- Messages Section Styling -------------------- */
.messages-section {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 2px solid #456882;
}

.messages-title {
  color: #F9F3EF;
  margin-bottom: 20px;
  font-size: 20px;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message-item {
  background-color: #456882;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.message-header {
  margin-bottom: 8px;
}

.author-name {
  font-weight: bold;
  color: #F9F3EF;
  font-size: 14px;
}

.message-content {
  color: #F9F3EF;
  font-size: 16px;
  line-height: 1.4;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 5px;
  border-left: 3px solid #007bff;
}
</style>