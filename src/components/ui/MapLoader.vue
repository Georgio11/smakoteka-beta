<script setup>
import {computed, onUnmounted, ref} from 'vue'
import {kindIcon, KINDS} from '@/components/map/kinds'

const STEP = 700
const TEXT_EVERY = 2

const TEXTS = ['Малюємо карту…', 'Шукаємо місця…', 'Розкладаємо мітки…']

const cover = `${import.meta.env.BASE_URL}cover.webp`
const iconsReady = ref(false)

document.fonts
    ?.load('900 24px "Smakoteka Icons"')
    .then(() => (iconsReady.value = true))
    .catch(() => (iconsReady.value = true))
const tick = ref(0)

const active = computed(() => tick.value % KINDS.length)
const text = computed(() => TEXTS[Math.floor(tick.value / TEXT_EVERY) % TEXTS.length])

const timer = setInterval(() => {
  tick.value += 1
}, STEP)

onUnmounted(() => clearInterval(timer))

</script>

<template>
  <div class="map-loader">
    <div class="map-loader__bg" :style="{ backgroundImage: `url(${cover})` }"></div>

    <div class="map-loader__body">
      <div class="map-loader__stage" aria-hidden="true">
        <span
            v-for="(kind, index) in KINDS"
            :key="kind"
            class="map-loader__dot"
            :class="{ 'is-on': index === active }"
            :style="{ background: `var(--kind-${kind})` }"
        >
          <i v-if="iconsReady" class="fa-solid" :class="kindIcon(kind)"></i>
        </span>
      </div>

      <Transition name="swap" mode="out-in">
        <p :key="text" class="map-loader__text">{{ text }}</p>
      </Transition>

    </div>
  </div>
</template>

<style scoped>
.map-loader {
  position: absolute;
  inset: 0;
  z-index: var(--z-toast);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--paper);
}

.map-loader__bg {
  position: absolute;
  inset: -6%;
  background-position: center;
  background-size: cover;
  filter: blur(9px);
}

.map-loader__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgb(16 18 22 / 46%);
}

.map-loader__body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.map-loader__stage {
  position: relative;
  width: 64px;
  height: 64px;
}

.map-loader__dot {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 24px;
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 0.35s var(--ease), transform 0.35s var(--ease);
  box-shadow: 0 6px 20px rgb(0 0 0 / 28%);
}

.map-loader__dot.is-on {
  opacity: 1;
  transform: scale(1);
}

.map-loader__text {
  font-size: 14px;
  color: #fff;
  text-shadow: 0 1px 16px rgb(0 0 0 / 60%);
}

@media (prefers-reduced-motion: reduce) {
  .map-loader__dot {
    transition: none;
  }
}
</style>
