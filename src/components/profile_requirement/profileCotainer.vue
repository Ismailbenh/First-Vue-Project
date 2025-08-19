<script setup>
const props = defineProps({
  id: String,
  firstName: String,
  lastName: String,
  message: String // New prop for message
})

const emit = defineEmits(['edit'])
import userIcon from '../icons/userIcon.vue'
import CustomButton from './button.vue'

function handleEdit() {
  emit('edit', props.id) // Pass the ID with the event
}
</script>

<template>
  <div class="content">
    <userIcon />
    <p>{{ firstName }}</p>
    <p>{{ lastName }}</p>
    <p class="message" v-if="message">{{ message }}</p>
    <CustomButton name="Edit" @click="handleEdit" />
  </div>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px;
  min-width: 180px;
  background-color: #456882;
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
</style>