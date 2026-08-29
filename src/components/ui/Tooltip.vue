<script setup>
import {computed, onUnmounted, ref, useId} from 'vue'

const GAP = 8
const EDGE = 8
const CARET = 8
const FALLBACK_DELAY = 500

const props = defineProps({
  text: {type: String, required: true},
  side: {type: String, default: 'bottom'},
  align: {type: String, default: 'end'},
})

const id = useId()
const anchor = ref(null)
const open = ref(false)
const rect = ref(null)

let timer = null

function measure() {
  const found = anchor.value?.getBoundingClientRect()

  if (found) rect.value = found
}

function readDelay() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--tip-delay')

  return parseFloat(raw) * 1000 || FALLBACK_DELAY
}

function show(delay = null) {
  clearTimeout(timer)

  timer = setTimeout(() => {
    measure()
    open.value = true

    window.addEventListener('scroll', measure, {capture: true, passive: true})
    window.addEventListener('resize', measure)
  }, delay ?? readDelay())
}

function hide() {
  clearTimeout(timer)
  open.value = false

  window.removeEventListener('scroll', measure, {capture: true})
  window.removeEventListener('resize', measure)
}

const style = computed(() => {
  const box = rect.value

  if (!box) return null

  const vertical = props.side === 'bottom'
      ? {top: `${box.bottom + GAP}px`}
      : {bottom: `${window.innerHeight - box.top + GAP}px`}

  const offset = props.align === 'end'
      ? Math.max(EDGE, window.innerWidth - box.right)
      : Math.max(EDGE, box.left)

  const horizontal = props.align === 'end' ? {right: `${offset}px`} : {left: `${offset}px`}

  const center = box.left + box.width / 2
  const edge = props.align === 'end' ? window.innerWidth - offset : offset
  const caret = Math.abs(edge - center) - CARET / 2

  return {...vertical, ...horizontal, '--tip-caret': `${Math.max(EDGE, caret)}px`}
})

onUnmounted(hide)
</script>

<template>
  <span
      ref="anchor"
      class="tooltip"
      @mouseenter="show()"
      @mouseleave="hide"
      @focusin="show(0)"
      @focusout="hide"
  >
    <slot :id="id"/>

    <Teleport to="body">
      <Transition name="tip">
        <span
            v-if="open"
            :id="id"
            class="tooltip__bubble"
            :class="[`tooltip__bubble--${side}`, `tooltip__bubble--${align}`]"
            :style="style"
            role="tooltip"
        >{{ text }}</span>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.tooltip {
  display: inline-flex;
}

.tooltip__bubble {
  position: fixed;
  z-index: var(--z-toast);
  width: max-content;
  max-width: 240px;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-sm);
  background: #1b2130;
  color: #fff;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  white-space: normal;
  pointer-events: none;
}

.tooltip__bubble::before {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  background: #1b2130;
  transform: rotate(45deg);
}

.tooltip__bubble--bottom::before { top: -3px; }
.tooltip__bubble--top::before { bottom: -3px; }

.tooltip__bubble--end::before { right: var(--tip-caret, var(--s-4)); }
.tooltip__bubble--start::before { left: var(--tip-caret, var(--s-4)); }

.tip-enter-active,
.tip-leave-active {
  transition: opacity var(--dur) var(--ease);
}

.tip-enter-from,
.tip-leave-to {
  opacity: 0;
}
</style>
