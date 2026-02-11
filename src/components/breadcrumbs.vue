<script setup>
import { defineProps } from 'vue'

// Props to receive breadcrumb data
defineProps({
  breadcrumbs: {
    type: Array,
    required: true,
    
  }
})
</script>
<template>
  <nav class="breadcrumb-nav" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li 
        v-for="(crumb, index) in breadcrumbs" 
        :key="index"
        class="breadcrumb-item"
        :class="{ 'active': index === breadcrumbs.length - 1 }"
      >
        <!-- If it's the last item (current page) or no route, show as text -->
        <span v-if="index === breadcrumbs.length - 1 || !crumb.route" class="breadcrumb-text">
          {{ crumb.label }}
        </span>
        
        <!-- If it has a route and not the last item, show as link -->
        <router-link v-else :to="crumb.route" class="breadcrumb-link">
          {{ crumb.label }}
        </router-link>
        
        <!-- Separator (not for the last item) -->
        <span v-if="index < breadcrumbs.length - 1" class="breadcrumb-separator">
          /
        </span>
      </li>
    </ol>
  </nav>
</template>


<style scoped>
.breadcrumb-nav {
  margin-bottom: 10px;
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border-left: 4px solid #007bff;
  background-color: #1e293b;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  flex-wrap: wrap;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
}

.breadcrumb-link {
  color: #007bff;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-weight: 500;
}

.breadcrumb-link:hover {
  background-color: rgba(0, 123, 255, 0.1);
  color: #0056b3;
}

.breadcrumb-text {
  color: #F9F3EF;
  padding: 4px 8px;
  font-weight: 600;
}

.breadcrumb-item.active .breadcrumb-text {
  color: #ffd700;
}

.breadcrumb-separator {
  margin: 0 8px;
  color: #888;
  font-weight: bold;
  user-select: none;
}

/* Responsive design */
@media (max-width: 768px) {
  .breadcrumb-nav {
    padding: 8px 12px;
  }
  
  .breadcrumb-link,
  .breadcrumb-text {
    padding: 2px 4px;
    font-size: 14px;
  }
  
  .breadcrumb-separator {
    margin: 0 4px;
  }
}
</style>