<script setup>
import {kindIcon, kindLabel, KINDS} from '@/components/map/kinds'
import Tooltip from "@/components/ui/Tooltip.vue";

const UNCONFIRMED_TIP =
    'Показуємо тільки ті, яких не підтвердило жодне джерело. ' +
    'Могли давно закритись — а могли й працювати, просто про них ніхто не подбав.'

const ACCESS_TIP =
    'Показуємо ті, де сходинок точно немає. ' +
    'Про решту ми просто не знаємо — це не означає, що там незручно.'

const filters = defineModel({default: () => ({kinds: [], stepFree: false, unconfirmedOnly: false})})

function toggleKind(kind) {
  const kinds = filters.value.kinds.includes(kind)
      ? filters.value.kinds.filter((item) => item !== kind)
      : [...filters.value.kinds, kind]

  filters.value = {...filters.value, kinds}
}

function toggleStepFree() {
  filters.value = {...filters.value, stepFree: !filters.value.stepFree}
}

// TEMPORARY: a chip is the stopgap; the plan is to rank places by zoom instead.
function toggleUnconfirmed() {
  filters.value = {...filters.value, unconfirmedOnly: !filters.value.unconfirmedOnly}
}

</script>

<template>
  <div class="map-filters">
    <div class="map-filters__kinds" role="group" aria-label="Фільтр за типом місця">
      <button
          v-for="kind in KINDS"
          :key="kind"
          class="chip"
          :class="{ 'is-on': filters.kinds.includes(kind) }"
          :aria-pressed="filters.kinds.includes(kind)"
          :data-kind="kind"
          @click="toggleKind(kind)"
      >
        <i class="fa-solid" :class="kindIcon(kind)" aria-hidden="true"></i>
        <span>{{ kindLabel(kind) }}</span>
      </button>
    </div>

    <Tooltip :text="ACCESS_TIP" v-slot="{ id }">
      <button
          class="chip chip--access"
          :class="{ 'is-on': filters.stepFree }"
          :aria-pressed="filters.stepFree"
          :aria-describedby="id"
          @click="toggleStepFree"
      >
        <i class="fa-solid fa-wheelchair" aria-hidden="true"></i>
        <span>Безбарʼєрно</span>
      </button>
    </Tooltip>

    <div class="map-filters__admin">
      <Tooltip :text="UNCONFIRMED_TIP" v-slot="{ id }">
        <button
            class="chip chip--muted"
            :class="{ 'is-on': filters.unconfirmedOnly }"
            :aria-pressed="filters.unconfirmedOnly"
            :aria-describedby="id"
            @click="toggleUnconfirmed"
        >
          <i class="fa-solid fa-circle-question" aria-hidden="true"></i>
          <span>Непідтверджені</span>
        </button>
      </Tooltip>
    </div>
  </div>
</template>


<style scoped>
.map-filters {
  position: absolute;
  top: var(--pad);
  right: var(--pad);
  z-index: var(--z-ui);
  display: flex;
  align-items: flex-start;
  gap: var(--gap-lg);
}

.map-filters__kinds {
  display: flex;
  gap: var(--gap);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
  color: var(--ink);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}

.chip:hover {
  border-color: var(--line-2);
}

.chip.is-on {
  color: #fff;
  border-color: transparent;
}

.chip.is-on[data-kind='cafe'] {
  background: var(--kind-cafe);
}

.chip.is-on[data-kind='restaurant'] {
  background: var(--kind-restaurant);
}

.chip.is-on[data-kind='bar'] {
  background: var(--kind-bar);
}

.chip.is-on[data-kind='pub'] {
  background: var(--kind-pub);
}

.chip.is-on[data-kind='fast_food'] {
  background: var(--kind-fast_food);
}

.chip--access.is-on {
  background: var(--ink);
  border-color: transparent;
}

/* Сірий, а не кольоровий: ця кнопка не про тип закладу, вона послаблює фільтр. */
.chip--muted.is-on {
  background: var(--ink-3);
  border-color: transparent;
}
</style>
