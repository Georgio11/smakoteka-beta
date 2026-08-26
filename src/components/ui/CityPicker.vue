<script setup>
defineProps({
  cities: {type: Array, default: () => []},
})

defineEmits(['select'])
</script>

<template>
  <div class="city-picker">
    <div class="city-picker__box">
      <h2 class="city-picker__title">Звідки почнемо?</h2>
      <button
          v-for="item in cities"
          :key="item.id"
          class="city-picker__item"
          @click="$emit('select', item.id)"
      >
        {{ item.title }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.city-picker {
  position: fixed;
  inset: 0;
  z-index: var(--z-toast);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--pad);
  background: rgb(20 22 26 / 45%);

}

.city-picker__box {
  width: 320px;
  max-width: 100%;
  padding: var(--pad);
  border-radius: var(--r-lg);
  background: var(--card);
  box-shadow: 0 12px 40px rgb(0 0 0 / 22%);
}

.city-picker__title {
  font-size: 20px;
  font-weight: 600;
}

.city-picker__hint {
  margin: 6px 0 var(--gap-lg);
  font-size: 13px;
  color: var(--ink-3);
}

.city-picker__item {
  display: block;
  width: 100%;
  height: var(--control-h);
  margin-top: var(--gap);
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--card);
  font-size: 15px;
  text-align: left;
  padding: 0 14px;
  color: var(--ink);
}

@media (hover: hover) {
  .city-picker__item:hover {
    border-color: var(--line-2);
    background: var(--paper);
  }
}
</style>
