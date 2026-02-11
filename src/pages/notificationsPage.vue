<template>
  <div class="app-container">
    <Sidebar />
    
    <main class="main-content">
      <Breadcrumbs :breadcrumbs="breadcrumbs" />
      
      <!-- Header -->
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">Notifications</h1>
          <p class="page-subtitle">Stay updated with system alerts and <span class="highlight">group requests</span></p>
        </div>
      </header>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Total Notifications</span>          
          </div>
          <div class="stat-value">{{ notifications.length }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Unread</span>           
          </div>
          <div class="stat-value stat-value-unread">{{ unreadCount }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-label">Group Requests</span>
          </div>
          <div class="stat-value">{{ groupRequestCount }}</div>
        </div>
      </div>

      <!-- Actions and Filters -->
      <div class="actions-section">
        <div class="action-buttons">
          <button 
            @click="markAllAsRead"
            :disabled="unreadCount === 0"
            class="btn btn-secondary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Mark All as Read
          </button>
          
          <button 
            @click="clearAllNotifications"
            :disabled="notifications.length === 0"
            class="btn btn-ghost"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Clear All
          </button>
        </div>
        
        <select v-model="filterType" class="filter-select">
          <option value="all">All Notifications</option>
          <option value="unread">Unread Only</option>
          <option value="group_request">Group Requests</option>
          <option value="system">System Notifications</option>
        </select>
      </div>

      <!-- Notifications List -->
      <div class="notifications-container">
        <div class="container-header">
          <h2 class="container-title">Recent Activity</h2>
          <p class="container-subtitle">Showing {{ filteredNotifications.length }} of {{ notifications.length }} notifications</p>
        </div>
        
        <!-- Empty State -->
        <div v-if="filteredNotifications.length === 0" class="empty-state">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <h3 class="empty-title">{{ getEmptyTitle() }}</h3>
          <p class="empty-message">{{ getEmptyMessage() }}</p>
        </div>

        <!-- Notifications -->
        <div v-else class="notifications-list">
          <div 
            v-for="notification in filteredNotifications" 
            :key="notification.id"
            :class="['notification-item', { 
              'unread': !notification.read, 
              'urgent': notification.priority === 'high' 
            }]"
          >
            <!-- Header -->
            <div class="notification-header">
              <div class="notification-left">
                <span :class="['type-badge', notification.type]">
                  {{ getTypeLabel(notification.type) }}
                </span>
                <span v-if="notification.priority === 'high'" class="priority-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  High Priority
                </span>
              </div>
              
              <div class="notification-right">
                <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                <button 
                  v-if="!notification.read"
                  @click="markAsRead(notification.id)"
                  class="icon-btn"
                  title="Mark as read"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
                <button 
                  @click="deleteNotification(notification.id)"
                  class="icon-btn icon-btn-danger"
                  title="Delete"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="notification-content">
              <h4 class="notification-title">{{ notification.title }}</h4>
              <p class="notification-message">{{ notification.message }}</p>
              
              <!-- Profile Info -->
              <div v-if="notification.profileInfo" class="profile-info">
                <div class="profile-avatar">
                  <img 
                    v-if="notification.profileInfo.avatarUrl" 
                    :src="notification.profileInfo.avatarUrl.startsWith('http') ? notification.profileInfo.avatarUrl : `http://localhost:3000/${notification.profileInfo.avatarUrl.replace(/^\/+/, '')}`"
                    :alt="notification.profileInfo.fullName"
                    class="avatar-img"
                  />
                  <div v-else class="avatar-placeholder">
                    <span>{{ notification.profileInfo.firstName?.charAt(0) }}{{ notification.profileInfo.lastName?.charAt(0) }}</span>
                  </div>
                </div>
                <div class="profile-details">
                  <span class="profile-name">{{ notification.profileInfo.fullName }}</span>
                  <span class="profile-meta">wants to join this group</span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div v-if="notification.type === 'group_request' && !notification.resolved" class="action-buttons-inline">
                <button 
                  @click="handleGroupRequest(notification.id, 'approve')"
                  class="btn btn-success"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Approve
                </button>
                <button 
                  @click="handleGroupRequest(notification.id, 'deny')"
                  class="btn btn-danger"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Deny
                </button>
              </div>

              <!-- Resolution Status -->
              <div v-if="notification.resolved" class="resolution-status">
                <span :class="['status-badge', notification.resolution]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline v-if="notification.resolution === 'approved'" points="20 6 9 17 4 12"></polyline>
                    <line v-else x1="18" y1="6" x2="6" y2="18"></line>
                    <line v-if="notification.resolution === 'denied'" x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
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

function getEmptyTitle() {
  switch (filterType.value) {
    case 'unread':
      return 'All caught up!'
    case 'group_request':
      return 'No pending requests'
    case 'system':
      return 'No system alerts'
    default:
      return 'No notifications'
  }
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
}

/* Header */
.page-header {
  margin-bottom: 2rem;
}

.header-content {
  max-width: 800px;
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

.stat-value-unread {
  color: #ef4444;
}

/* Actions Section */
.actions-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.action-buttons {
  display: flex;
  gap: 0.75rem;
}

.filter-select {
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #0f172a;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-weight: 500;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Notifications Container */
.notifications-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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

.container-subtitle {
  font-size: 0.875rem;
  color: #64748b;
}

/* Empty State */
.empty-state {
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  color: #cbd5e1;
  margin-bottom: 1.5rem;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.empty-message {
  font-size: 0.95rem;
  color: #64748b;
}

/* Notifications List */
.notifications-list {
  display: flex;
  flex-direction: column;
}

.notification-item {
  padding: 1.75rem 2rem;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s;
  position: relative;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: #f8fafc;
}

.notification-item.unread {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
}

.notification-item.urgent {
  background: #fef2f2;
  border-left: 4px solid #ef4444;
}

/* Notification Header */
.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.notification-left,
.notification-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.type-badge.group_request {
  background: #dbeafe;
  color: #1e40af;
}

.type-badge.system {
  background: #e0e7ff;
  color: #5b21b6;
}

.type-badge.profile {
  background: #d1fae5;
  color: #065f46;
}

.type-badge.room {
  background: #cffafe;
  color: #155e75;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #fee2e2;
  color: #991b1b;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.notification-time {
  color: #94a3b8;
  font-size: 0.875rem;
  font-weight: 500;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.icon-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
}

.icon-btn-danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
  color: #ef4444;
}

/* Notification Content */
.notification-content {
  padding-left: 0.25rem;
}

.notification-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.notification-message {
  font-size: 0.95rem;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 1rem;
}

/* Profile Info */
.profile-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid #e2e8f0;
}

.profile-avatar {
  flex-shrink: 0;
}

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e2e8f0;
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.profile-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.profile-name {
  font-weight: 600;
  color: #0f172a;
  font-size: 0.95rem;
}

.profile-meta {
  font-size: 0.85rem;
  color: #64748b;
}

/* Action Buttons Inline */
.action-buttons-inline {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

/* Resolution Status */
.resolution-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 1rem;
  border: 1px solid #e2e8f0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-badge.approved {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.denied {
  background: #fee2e2;
  color: #991b1b;
}

.resolution-time {
  color: #94a3b8;
  font-size: 0.85rem;
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: white;
  border-color: #cbd5e1;
}

.btn-ghost {
  background: transparent;
  color: #64748b;
  border: 1px solid transparent;
}

.btn-ghost:hover:not(:disabled) {
  background: #f8fafc;
  color: #334155;
}

.btn-success {
  background: #10b981;
  color: white;
  border: 1px solid transparent;
}

.btn-success:hover {
  background: #059669;
}

.btn-danger {
  background: transparent;
  color: #ef4444;
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

/* Responsive */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    padding: 1.5rem;
  }
  
  .page-title {
    font-size: 1.75rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .filter-select {
    width: 100%;
  }
  
  .notification-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .notification-right {
    width: 100%;
    justify-content: space-between;
  }
  
  .action-buttons-inline {
    flex-direction: column;
  }
}
</style>