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
          class="btn map-filters__chip"
          :class="{ 'btn--on': filters.kinds.includes(kind) }"
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
          class="btn map-filters__chip map-filters__chip--access"
          :class="{ 'btn--on': filters.stepFree }"
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
            class="btn map-filters__chip map-filters__chip--muted"
            :class="{ 'btn--on': filters.unconfirmedOnly }"
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
  gap: var(--s-3);
}

.map-filters__kinds {
  display: flex;
  gap: var(--s-2);
}

.map-filters__chip[data-kind='cafe'] {
  --btn-accent: var(--kind-cafe);
}

.map-filters__chip[data-kind='restaurant'] {
  --btn-accent: var(--kind-restaurant);
}

.map-filters__chip[data-kind='bar'] {
  --btn-accent: var(--kind-bar);
}

.map-filters__chip[data-kind='pub'] {
  --btn-accent: var(--kind-pub);
}

.map-filters__chip[data-kind='fast_food'] {
  --btn-accent: var(--kind-fast_food);
}

.map-filters__chip--access {
  --btn-accent: var(--ink);
}

.map-filters__chip--muted {
  --btn-accent: var(--ink-3);
}
</style>
