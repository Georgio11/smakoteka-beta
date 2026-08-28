<script setup>
defineProps({
  value: {type: Number, default: 0},
})
</script>

<template>
  <span class="counter">{{ value }}</span>
</template>

<style scoped>
.counter {
  padding: var(--s-05) var(--s-1);
  border-radius: var(--r-pill);
  background: var(--red);
  color: var(--card);
  font-size: 11px;
  font-weight: 600;
}
</style>
