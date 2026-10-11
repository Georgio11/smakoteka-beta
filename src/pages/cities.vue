<script setup>
import {onMounted} from 'vue'
import {navigateTo, useAsyncData} from '#imports'
import CityPicker from '@/components/ui/CityPicker.vue'
import {useCity} from '@/composables/useCity'
import {readLastCity} from '@/lib/lastCity'
import {cities} from '@/lib/placesRepo'

const {pickCity} = useCity()
const {data: cityList} = await useAsyncData('cities', () => cities())

onMounted(() => {
  const saved = readLastCity()

  if (cityList.value?.some((city) => city.id === saved)) {
    navigateTo({name: 'city', params: {city: saved}}, {replace: true})
  }
})
</script>

<template>
  <CityPicker :cities="cityList ?? []" @select="pickCity"/>
</template>
