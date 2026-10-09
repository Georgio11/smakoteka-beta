<script setup>
import {defineAsyncComponent} from 'vue'
import MapLoader from '@/components/ui/MapLoader.vue'

const MapView = defineAsyncComponent({
  loader: () => import('@/view/MapView.vue'),
  loadingComponent: MapLoader,
  delay: 0,
  suspensible: false,
})
</script>

<template>
  <MapView/>
</template>
