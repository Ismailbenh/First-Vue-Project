<script setup>
const props = defineProps({
  id: String,
  firstName: String,
  lastName: String,
  message: String,
  isSelectable: Boolean, // New prop for message
  isSelected: Boolean
})
import userIcon from '../icons/userIcon.vue'
import CustomButton from './button.vue'

const emit = defineEmits(['edit', 'delete','select'])


function handleSelect() {
  emit('select', props.id )
}
</script>

<template>
  <div class="content" :class="{ selected: isSelected }">
    <!-- Only show checkbox when selectable -->
    <input 
      v-if="isSelectable"
      type="checkbox" 
      :checked="isSelected"
      @change="handleSelect"
      class="profile-checkbox"
    />
    
    <userIcon />
    <p>{{ firstName }}</p>
    <p>{{ lastName }}</p>
    <p class="message" v-if="message">{{ message }}</p>
    
    <!-- Slot for buttons - will show whatever is passed in -->
    <slot name="actions"></slot>
  </div>
</template>
<style scoped>
.content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px;
  min-width: 180px;
  background-color: #456882;
  border-radius: 12px;
}
p {
  min-height: 24px;
  color: white;
  font-weight: bold;
}
.message {
  font-size: 12px;
  text-align: center;
  font-weight: normal;
  opacity: 0.9;
}
.buttons {
  display: flex;
  gap: 20px;
}
.selected {
  border: 2px solid #007bff;
  background-color: #5a7a9a ;
}

.profile-checkbox {
  position: absolute;
  top: 10px;
  left: 10px;
}


</style>