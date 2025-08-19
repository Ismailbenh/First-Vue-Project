<script setup>
defineProps({
  modelValue: String
})

defineEmits(['update:modelValue'])
</script>
<template>
  <input 
    type="text" 
    placeholder="Enter person's Message here"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>
<style>
input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
}
</style>