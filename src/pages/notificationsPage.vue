<template>
  <div class="layout">
    <Sidebar />
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      <h1 class="title">Notifications</h1>

      <!-- Notification Stats -->
      <div class="notifications-stats">
        <div class="stat-card">
          <h3>Total Notifications</h3>
          <span class="stat-number">{{ notifications.length }}</span>
        </div>
        <div class="stat-card">
          <h3>Unread</h3>
          <span class="stat-number unread">{{ unreadCount }}</span>
        </div>
        <div class="stat-card">
          <h3>Group Join Requests</h3>
          <span class="stat-number">{{ groupRequestCount }}</span>
        </div>
      </div>

      <!-- Notification Actions -->
      <div class="notification-actions">
        <CustomButton 
          name="Mark All as Read" 
          @click="markAllAsRead"
          :disabled="unreadCount === 0"
          class="mark-read-btn"
        />
        <CustomButton 
          name="Clear All Notifications" 
          @click="clearAllNotifications"
          :disabled="notifications.length === 0"
          class="clear-all-btn"
        />
        <select v-model="filterType" class="filter-select">
          <option value="all">All Notifications</option>
          <option value="unread">Unread Only</option>
          <option value="group_request">Group Requests</option>
          <option value="system">System Notifications</option>
        </select>
      </div>

      <!-- Notifications List -->
      <div class="notifications-container">
        <div v-if="filteredNotifications.length === 0" class="no-notifications">
          <div class="empty-state">
            <div class="empty-icon">🔔</div>
            <h3>No notifications</h3>
            <p>{{ getEmptyMessage() }}</p>
          </div>
        </div>

        <div v-else class="notifications-list">
          <div 
            v-for="notification in filteredNotifications" 
            :key="notification.id"
            :class="['notification-item', { 'unread': !notification.read, 'urgent': notification.priority === 'high' }]"
          >
            <!-- Notification Header -->
            <div class="notification-header">
              <div class="notification-type">
                <span :class="['type-badge', notification.type]">
                  {{ getTypeLabel(notification.type) }}
                </span>
                <span v-if="notification.priority === 'high'" class="priority-badge">
                  High Priority
                </span>
              </div>
              <div class="notification-meta">
                <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                <button 
                  v-if="!notification.read"
                  @click="markAsRead(notification.id)"
                  class="mark-read-single"
                  title="Mark as read"
                >
                  ✓
                </button>
                <button 
                  @click="deleteNotification(notification.id)"
                  class="delete-notification"
                  title="Delete notification"
                >
                  ×
                </button>
              </div>
            </div>

            <!-- Notification Content -->
            <div class="notification-content">
              <h4 class="notification-title">{{ notification.title }}</h4>
              <p class="notification-message">{{ notification.message }}</p>
              
              <!-- Profile Information (if applicable) -->
              <div v-if="notification.profileInfo" class="profile-info">
                <div class="profile-avatar-mini">
                  <img 
                    v-if="notification.profileInfo.avatarUrl" 
                    :src="notification.profileInfo.avatarUrl.startsWith('http') ? notification.profileInfo.avatarUrl : `http://localhost:3000/${notification.profileInfo.avatarUrl.replace(/^\/+/, '')}`"
                    :alt="notification.profileInfo.fullName"
                    class="avatar-mini"
                  />
                  <div v-else class="avatar-placeholder-mini">
                    <span>{{ notification.profileInfo.firstName?.charAt(0) }}{{ notification.profileInfo.lastName?.charAt(0) }}</span>
                  </div>
                </div>
                <span class="profile-name">{{ notification.profileInfo.fullName }}</span>
              </div>

              <!-- Action Buttons for Group Requests -->
              <div v-if="notification.type === 'group_request' && !notification.resolved" class="notification-actions-inline">
                <CustomButton 
                  name="Approve" 
                  @click="handleGroupRequest(notification.id, 'approve')"
                  class="approve-btn"
                />
                <CustomButton 
                  name="Deny" 
                  @click="handleGroupRequest(notification.id, 'deny')"
                  class="deny-btn"
                />
              </div>

              <!-- Resolution Status -->
              <div v-if="notification.resolved" class="resolution-status">
                <span :class="['status-badge', notification.resolution]">
                  {{ notification.resolution === 'approved' ? 'Approved' : 'Denied' }}
                </span>
                <span class="resolution-time">{{ formatTime(notification.resolvedAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Sidebar from '@/components/sidebar.vue'
import Breadcrumbs from '@/components/breadcrumbs.vue'
import CustomButton from '@/components/profile_requirement/button.vue'

const router = useRouter()
const notifications = ref([])
const filterType = ref('all')

const breadcrumbs = [
  { label: 'Home', route: { name: 'profilePage' } },
  { label: 'Notifications', route: { name: 'notificationsPage' } }
]

// Computed properties
const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length
})

const groupRequestCount = computed(() => {
  return notifications.value.filter(n => n.type === 'group_request' && !n.resolved).length
})

const filteredNotifications = computed(() => {
  let filtered = notifications.value
  
  switch (filterType.value) {
    case 'unread':
      filtered = filtered.filter(n => !n.read)
      break
    case 'group_request':
      filtered = filtered.filter(n => n.type === 'group_request')
      break
    case 'system':
      filtered = filtered.filter(n => n.type === 'system')
      break
  }
  
  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

// Methods
async function loadNotifications() {
  try {
    const response = await fetch('http://localhost:3000/api/notifications')
    if (response.ok) {
      notifications.value = await response.json()
    } else {
      console.error('Failed to load notifications')
    }
  } catch (error) {
    console.error('Error loading notifications:', error)
    // Load sample data for demonstration
    loadSampleData()
  }
}

function loadSampleData() {
  // Sample notifications for demonstration
  notifications.value = [
    {
      id: 'notif_1',
      type: 'group_request',
      title: 'Group Join Request',
      message: 'John Doe wants to join the "Developers" group',
      priority: 'normal',
      read: false,
      resolved: false,
      createdAt: new Date().toISOString(),
      profileInfo: {
        id: 'profile_1',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        avatarUrl: null
      }
    },
    {
      id: 'notif_2',
      type: 'system',
      title: 'Room Assignment Complete',
      message: '15 profiles have been automatically assigned to available rooms',
      priority: 'normal',
      read: true,
      resolved: false,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'notif_3',
      type: 'group_request',
      title: 'Group Join Request',
      message: 'Jane Smith wants to join the "Teachers" group',
      priority: 'high',
      read: false,
      resolved: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      profileInfo: {
        id: 'profile_2',
        firstName: 'Jane',
        lastName: 'Smith',
        fullName: 'Jane Smith',
        avatarUrl: null
      }
    }
  ]
}

async function markAsRead(notificationId) {
  try {
    const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}/read`, {
      method: 'PUT'
    })
    
    if (response.ok) {
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.read = true
      }
    }
  } catch (error) {
    console.error('Error marking notification as read:', error)
    // Fallback for demo
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
    }
  }
}

async function markAllAsRead() {
  try {
    const response = await fetch('http://localhost:3000/api/notifications/read-all', {
      method: 'PUT'
    })
    
    if (response.ok) {
      notifications.value.forEach(n => n.read = true)
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    // Fallback for demo
    notifications.value.forEach(n => n.read = true)
  }
}

async function deleteNotification(notificationId) {
  if (!confirm('Are you sure you want to delete this notification?')) return
  
  try {
    const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}`, {
      method: 'DELETE'
    })
    
    if (response.ok) {
      const index = notifications.value.findIndex(n => n.id === notificationId)
      if (index > -1) {
        notifications.value.splice(index, 1)
      }
    }
  } catch (error) {
    console.error('Error deleting notification:', error)
    // Fallback for demo
    const index = notifications.value.findIndex(n => n.id === notificationId)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }
}

async function clearAllNotifications() {
  if (!confirm('Are you sure you want to clear all notifications?')) return
  
  try {
    const response = await fetch('http://localhost:3000/api/notifications', {
      method: 'DELETE'
    })
    
    if (response.ok) {
      notifications.value = []
    }
  } catch (error) {
    console.error('Error clearing notifications:', error)
    // Fallback for demo
    notifications.value = []
  }
}

async function handleGroupRequest(notificationId, action) {
  try {
    const response = await fetch(`http://localhost:3000/api/notifications/${notificationId}/resolve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action })
    })
    
    if (response.ok) {
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.resolved = true
        notification.resolution = action === 'approve' ? 'approved' : 'denied'
        notification.resolvedAt = new Date().toISOString()
        notification.read = true
      }
      
      alert(`Group request ${action === 'approve' ? 'approved' : 'denied'} successfully`)
    }
  } catch (error) {
    console.error('Error handling group request:', error)
    // Fallback for demo
    const notification = notifications.value.find(n => n.id === notificationId)
    if (notification) {
      notification.resolved = true
      notification.resolution = action === 'approve' ? 'approved' : 'denied'
      notification.resolvedAt = new Date().toISOString()
      notification.read = true
    }
    
    alert(`Group request ${action === 'approve' ? 'approved' : 'denied'} successfully`)
  }
}

function getTypeLabel(type) {
  const labels = {
    group_request: 'Group Request',
    system: 'System',
    profile: 'Profile',
    room: 'Room',
    general: 'General'
  }
  return labels[type] || 'Notification'
}

function getEmptyMessage() {
  switch (filterType.value) {
    case 'unread':
      return 'All notifications have been read'
    case 'group_request':
      return 'No group join requests at this time'
    case 'system':
      return 'No system notifications'
    default:
      return 'You have no notifications at this time'
  }
}

function formatTime(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

onMounted(() => {
  loadNotifications()
})
</script>

<style scoped>
/* Layout */
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
  color: #f8f9fa;
}

.title {
  color: #ffffff;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

/* Stats Cards */
.notifications-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #234a66;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #3A6B85;
}

.stat-card h3 {
  margin: 0 0 0.5rem 0;
  color: #F9F3EF;
  font-size: 0.9rem;
  font-weight: 500;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: #007bff;
}

.stat-number.unread {
  color: #dc3545;
}

/* Actions */
.notification-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  align-items: center;
}

.mark-read-btn {
  background: #28a745 !important;
  color: white;
}

.clear-all-btn {
  background: #dc3545 !important;
  color: white;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #3A6B85;
  border-radius: 4px;
  background: #234a66;
  color: #F9F3EF;
}

/* Notifications Container */
.notifications-container {
  background: #234a66;
  border-radius: 8px;
  border: 1px solid #3A6B85;
  overflow: hidden;
}

/* Empty State */
.no-notifications {
  padding: 3rem;
  text-align: center;
}

.empty-state {
  color: #F9F3EF;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #ffffff;
}

/* Notifications List */
.notifications-list {
  display: flex;
  flex-direction: column;
}

.notification-item {
  padding: 1.5rem;
  border-bottom: 1px solid #3A6B85;
  background: #234a66;
  transition: background-color 0.2s;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: #2C5F7A;
}

.notification-item.unread {
  border-left: 4px solid #007bff;
  background: #1e4a5f;
}

.notification-item.urgent {
  border-left: 4px solid #dc3545;
}

/* Notification Header */
.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.notification-type {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.type-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.type-badge.group_request {
  background: #007bff;
  color: white;
}

.type-badge.system {
  background: #6f42c1;
  color: white;
}

.type-badge.profile {
  background: #28a745;
  color: white;
}

.type-badge.room {
  background: #17a2b8;
  color: white;
}

.priority-badge {
  background: #dc3545;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
}

.notification-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notification-time {
  color: #adb5bd;
  font-size: 0.8rem;
}

.mark-read-single,
.delete-notification {
  background: none;
  border: none;
  color: #adb5bd;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.mark-read-single:hover {
  background: #28a745;
  color: white;
}

.delete-notification:hover {
  background: #dc3545;
  color: white;
}

/* Notification Content */
.notification-content h4 {
  margin: 0 0 0.5rem 0;
  color: #ffffff;
  font-size: 1.1rem;
}

.notification-message {
  color: #F9F3EF;
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

/* Profile Info */
.profile-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1rem 0;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.profile-avatar-mini {
  width: 32px;
  height: 32px;
}

.avatar-mini {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #3A6B85;
}

.avatar-placeholder-mini {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #3A6B85;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  color: white;
}

.profile-name {
  color: #ffffff;
  font-weight: 500;
}

/* Inline Actions */
.notification-actions-inline {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.approve-btn {
  background: #28a745 !important;
  color: white;
}

.deny-btn {
  background: #dc3545 !important;
  color: white;
}

/* Resolution Status */
.resolution-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.approved {
  background: #28a745;
  color: white;
}

.status-badge.denied {
  background: #dc3545;
  color: white;
}

.resolution-time {
  color: #adb5bd;
  font-size: 0.8rem;
}

/* Responsive */
@media (max-width: 768px) {
  .notification-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .notification-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .notification-actions-inline {
    flex-direction: column;
  }
}
  </style>