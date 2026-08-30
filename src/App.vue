<script setup>
import MapLoader from '@/components/ui/MapLoader.vue'
import Alert from '@/components/ui/Alert.vue'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" v-if="Component"/>
    <MapLoader v-else/>
  </RouterView>

  <Alert/>
</template>
