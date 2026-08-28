<script setup>
import {computed, ref} from "vue";

import Search from '@/components/ui/Search.vue';
import MenuMap from "@/components/menu/MenuMap.vue";
import MenuProfile from "@/components/menu/MenuProfile.vue";
import MenuPlace from "@/components/menu/MenuPlace.vue";

const TABS = [
  {id: 'map', label: 'Карта', icon: 'fa-map'},
  {id: 'profile', label: 'Профіль', icon: 'fa-circle-user'},
]

const tab = ref('map');

const activeTab = computed(() => (props.place ? null : tab.value))

const props = defineProps({
  place: {type: Object, default: null},
})
const emit = defineEmits(['close'])

function pickTab(id) {
  tab.value = id
  emit('close')
}


</script>

<template>
  <div class="menu-wrapper">
    <div class="menu-wrapper__search">
      <Search/>
    </div>
    <div class="menu-wrapper__choice">
      <MenuPlace v-if="place" :key="place.uid" :place="place" @close="$emit('close')"/>
      <MenuProfile v-else-if="tab === 'profile'"/>
      <MenuMap v-else/>
    </div>
    <div class="menu-wrapper__btns">
      <button v-for="item in TABS" :key="item.id" class="menu-wrapper__btn"
              :class="{'menu-wrapper__btn--on': activeTab === item.id}"
              :aria-pressed="activeTab === item.id"
              @click="pickTab(item.id)"
      >
      <i class="fa-solid" :class="item.icon" aria-hidden="true"></i>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.menu-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  z-index: var(--z-panel);
  display: flex;
  flex-direction: column;
  width: var(--panel-w);
  height: 100%;
  background: var(--card);
  border-right: 1px solid var(--line);
}

.menu-wrapper__search {
  padding: var(--pad);
  border-bottom: 1px solid var(--line);
}

.menu-wrapper__choice {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* Місце під смугу прокрутки тримаємо завжди. Інакше вона зʼявляється разом
     із довгим вмістом, забирає свої 15px у панелі фіксованої ширини — і все
     всередині стискається просто від того, що розгорнули години. */
  scrollbar-gutter: stable;
  padding: var(--pad);
}

.menu-wrapper__btns {
  display: flex;
  border-top: 1px solid var(--line);
}

.menu-wrapper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  flex: 1;
  padding: var(--pad) 0;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 500;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease),
  box-shadow var(--dur) var(--ease);

  & + & {
    border-left: 1px solid var(--line);
  }

  &--on {
    box-shadow: inset 0 var(--s-1) 0 var(--plum);
    color: var(--ink);
  }
}

@media (hover: hover) {
  .menu-wrapper__btn:hover {
    background: var(--paper);
    color: var(--ink);
  }
}
</style>
