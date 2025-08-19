<script setup>
defineProps({
      icon:Object,
      name:String
    })
    
</script>

<template>
  <button>
    <component :is="icon" v-if="icon"  />
    <span v-if="name">{{ name }}</span>
  </button>
</template>

<style scoped>
  button {
    padding: 8px 16px;
    border: none;
    background-color: #007bff;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
  background-color: #0056b3; /* A darker shade of blue */
}
</style>