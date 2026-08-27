<script setup>
import CityPicker from '@/components/ui/CityPicker.vue'
import {useCity} from '@/composables/useCity'

const {cityList, pickCity} = useCity()
</script>

<template>
  <CityPicker :cities="cityList" @select="pickCity"/>
</template>
