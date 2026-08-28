<script setup>
import {computed} from 'vue'
import {plural} from '@/lib/plural'

const props = defineProps({
  cities: {type: Array, default: () => []},
})

defineEmits(['select'])

const cover = `${import.meta.env.BASE_URL}cover.webp`

const updatedAt = computed(() => {
  const last = props.cities
      .map((city) => city.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1)

  if (!last) return ''

  const [year, month, day] = last.split('-')

  return `${day}/${month}/${year}`
})

function placesLabel(count) {
  return `${count} ${plural(count, ['місце', 'місця', 'місць'])}`
}
</script>

<template>
  <div class="city-picker">
    <div class="city-picker__bg" :style="{ backgroundImage: `url(${cover})` }"></div>

    <div class="city-picker__body">
      <h1 class="city-picker__logo">СмакоТека</h1>

      <div class="city-picker__card">
        <p class="city-picker__q">Звідки почнемо?</p>

        <button
            v-for="item in cities"
            :key="item.id"
            class="city-picker__item"
            @click="$emit('select', item.id)"
        >
          <span>{{ item.title }}</span>
          <span class="city-picker__count">{{ placesLabel(item.places) }}</span>
        </button>
      </div>

      <p v-if="updatedAt" class="city-picker__date">Оновлено {{ updatedAt }}</p>
    </div>
  </div>
</template>

<style scoped>
.city-picker {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--pad);
  overflow: hidden;
  background: var(--paper);
}

.city-picker__bg {
  position: absolute;
  inset: -6%;
  background-position: center;
  background-size: cover;
  filter: blur(7px);
}

.city-picker__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgb(16 18 22 / 46%);
}

.city-picker__body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-5);
  width: 100%;
  max-width: 360px;
}

.city-picker__logo {
  font-size: clamp(40px, 8vw, 60px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: #fff;
  text-shadow: var(--text-shadow-lg);
}

.city-picker__card {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  width: 100%;
  padding: var(--pad);
  border-radius: var(--r-lg);
  background: var(--card);
  box-shadow: var(--shadow-4);
}

.city-picker__q {
  font-size: 14px;
  color: var(--ink-3);
}

.city-picker__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
  width: 100%;
  padding: var(--s-3);
  border: 1px solid var(--line);
  border-radius: var(--r);
  background: var(--card);
  font-size: 15px;
  color: var(--ink);
}

.city-picker__count {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
}

.city-picker__date {
  font-size: 13px;
  color: rgb(255 255 255 / 86%);
  text-shadow: var(--text-shadow);
}

@media (hover: hover) {
  .city-picker__item:hover {
    border-color: var(--line-2);
    background: var(--paper);
  }
}
</style>
