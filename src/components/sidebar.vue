<template>
  <aside class="sidebar">
    
    <button class="sidebar-btn" @click="goTo('profilePage')" title="Profiles">
      <UserIcon class="sidebar-icon" />
    </button>
    <button class="sidebar-btn" @click="goTo('groupsPage')" title="Groups">
      <GroupsIcon class="sidebar-icon" />
    </button>
    <button class="sidebar-btn" @click="goTo('roomsPage')" title="Rooms">
      <RoomsIcon class="sidebar-icon" />
    </button>
    <button class="sidebar-btn" @click="goTo('filterPage')" title="Filter">
      <FilterButton class="sidebar-icon" />
    </button>
    <button class="sidebar-btn notifications-btn" @click="goTo('notificationsPage')" title="Notifications">
      <NotificationIcon class="sidebar-icon" />
      <span v-if="notificationCount > 0" class="notification-badge">{{ notificationCount }}</span>
    </button>
  
    <button class="sidebar-btn add-profile-btn" @click="goToAddProfile" title="Add Profile">
      <AddIcon class="sidebar-icon" />
    </button>
    </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import GroupsIcon from '@/components/icons/groupsIcon.vue'
import RoomsIcon from '@/components/icons/addIcon copy 3.vue'
import AddIcon from '@/components/icons/addIcon.vue'
import UserIcon from '@/components/icons/userIcon.vue'
import FilterButton from './icons/filterButton.vue'
import NotificationIcon from './icons/notificationIcon.vue'

const router = useRouter()
const notificationCount = ref(0)

function goTo(page) {
  router.push({ name: page })
}

function goToAddProfile() {
  router.push({ name: 'infoPage' })
}

// Function to load notification count
async function loadNotificationCount() {
  try {
    const response = await fetch('http://localhost:3000/api/notifications/count')
    if (response.ok) {
      const result = await response.json()
      notificationCount.value = result.unreadCount || 0
    }
  } catch (error) {
    console.error('Error loading notification count:', error)
  }
}

onMounted(() => {
  loadNotificationCount()
  
  // Optional: Set up polling to update notification count periodically
  setInterval(loadNotificationCount, 30000) // Check every 30 seconds
})
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 70px;
  height: 100vh;
  background: #222b3a;
  color: #fff;
  padding: 18px 4px 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 2px 0 8px rgba(0,0,0,0.07);
  z-index: 1000;
}

.sidebar-title {
  font-size: 0.9rem;
  font-weight: bold;
  margin-bottom: 1.2rem;
  letter-spacing: 1px;
  color: #ffd700;
  text-align: center;
}

.sidebar-btn {
  background: #007bff;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 42px;
  height: 42px;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.sidebar-btn:hover {
  background: #0056b3;
}

.add-profile-btn {
  background: #28a745;
}

.add-profile-btn:hover {
  background: #1e7e34;
}

.notifications-btn {
  background: #ffc107;
  color: #212529;
}

.notifications-btn:hover {
  background: #e0a800;
}

.sidebar-icon {
  width: 1.5em;
  height: 1.5em;
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #dc3545;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 0.7rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #222b3a;
  min-width: 20px;
}
</style>