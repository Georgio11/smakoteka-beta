<script setup>
import {useId} from 'vue'

defineProps({
  text: {type: String, required: true},
  side: {type: String, default: 'bottom'},   // 'bottom' | 'top'
  align: {type: String, default: 'end'},     // 'end' | 'start'
})

const id = useId()
</script>

<template>
    <span class="tooltip" :class="[`tooltip--${side}`, `tooltip--${align}`]">
      <slot :id="id"/>
      <span :id="id" class="tooltip__bubble" role="tooltip">{{ text }}</span>
    </span>
</template>


<style scoped lang="scss">
.tooltip {
  position: relative;
  display: inline-flex;
}

.tooltip__bubble {
  position: absolute;
  z-index: var(--z-panel);
  width: max-content;
  max-width: 240px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #1b2130;
  color: #fff;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  text-align: left;
  white-space: normal;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur) var(--ease);
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

/* дві незалежні осі: 'bottom'/'top' і 'end'/'start' дають чотири комбінації */
.tooltip--bottom .tooltip__bubble { top: calc(100% + 8px); }
.tooltip--top .tooltip__bubble { bottom: calc(100% + 8px); }

.tooltip--end .tooltip__bubble { right: 0; }
.tooltip--start .tooltip__bubble { left: 0; }

/* каретка завжди дивиться в протилежний від бульбашки бік */
.tooltip--bottom .tooltip__bubble::before { top: -3px; }
.tooltip--top .tooltip__bubble::before { bottom: -3px; }

.tooltip--end .tooltip__bubble::before { right: var(--tip-caret, 16px); }
.tooltip--start .tooltip__bubble::before { left: var(--tip-caret, 16px); }

.tooltip:has(:focus-visible) .tooltip__bubble {
  opacity: 1;
}

@media (hover: hover) {
  .tooltip:hover .tooltip__bubble {
    opacity: 1;
  }
}
</style>
