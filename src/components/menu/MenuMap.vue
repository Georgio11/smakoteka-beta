<script setup>
import {useMapTab} from '@/composables/useMapTab'
import {useMapCount} from '@/composables/useMapCount'
import Counter from "@/components/ui/Counter.vue";

const {tab} = useMapTab()
const {shown} = useMapCount()

const TABS = [
  {id: 'all', label: 'Всі', icon: 'fa-border-all'},
  {id: 'was', label: 'Колекція', icon: 'fa-check'},
  {id: 'plan', label: 'Плани', icon: 'fa-bookmark'},
]
</script>

<template>
  <div class="menu-map">
    <div class="menu-map__btns">
      <button
          v-for="item in TABS"
          :key="item.id"
          class="btn menu-map__btn"
          :class="{'btn--on': tab === item.id}"
          :aria-pressed="tab === item.id"
          :data-tab="item.id"
          @click="tab = item.id"
      >
        <i class="fa-solid" :class="item.icon" aria-hidden="true"></i>
        <span>{{ item.label }}</span>
        <Counter v-if="item.id === 'all'" :value="shown"/>
      </button>
    </div>

    <div v-if="tab === 'all'" class="menu-map__all"></div>
    <div v-else-if="tab === 'was'" class="menu-map__was"></div>
    <div v-else class="menu-map__plan"></div>
  </div>
</template>

<style lang="scss" scoped>
.menu-map__btns {
  display: flex;
  gap: var(--s-2);
}

.menu-map__btn {
  flex: 1 1 auto;
  gap: var(--s-2);
  padding: var(--s-2);
  font-size: 14px;
}

.menu-map__btn[data-tab='was'] {
  --btn-accent: var(--mark-visited);
}

.menu-map__btn[data-tab='plan'] {
  --btn-accent: var(--mark-planned);
}
</style>