<script setup>
import {computed, defineAsyncComponent} from 'vue'
import {useAsyncData, useHead, useRoute, useRuntimeConfig, useSeoMeta} from '#imports'
import MapLoader from '@/components/ui/MapLoader.vue'
import MenuWrapper from '@/components/menu/MenuWrapper.vue'
import {kindName} from '@/components/map/kinds'
import {cities, placeByUid} from '@/lib/placesRepo'

definePageMeta({
  name: 'city',
  key: (route) => route.params.city,
})

const MapView = defineAsyncComponent({
  loader: () => import('@/view/MapView.vue'),
  loadingComponent: MapLoader,
  delay: 0,
  suspensible: false,
})

const BRAND = 'СмакоТека'

const route = useRoute()
const {siteUrl} = useRuntimeConfig().public

const {data} = await useAsyncData(
    () => `page:${route.params.city}:${route.params.place ?? ''}`,
    async () => {
      const {city, place: uid} = route.params
      const found = (await cities()).find((item) => item.id === city)

      return {
        cityTitle: found?.title ?? '',
        place: uid ? await placeByUid(city, uid) : null,
      }
    },
)

const place = computed(() => data.value?.place ?? null)
const cityTitle = computed(() => data.value?.cityTitle ?? '')

const title = computed(() => {
  if (place.value) return `${place.value.name} — ${kindName(place.value.kind)}, ${cityTitle.value} · ${BRAND}`

  return `${cityTitle.value}: кафе, ресторани й бари на карті · ${BRAND}`
})

const description = computed(() => {
  if (!place.value) return `Кафе, ресторани, бари й паби — ${cityTitle.value}. Години роботи, контакти й усе на одній карті.`

  const where = place.value.address ? `, ${place.value.address}` : ''

  return `${place.value.name} — ${kindName(place.value.kind)}${where}, ${cityTitle.value}. Години роботи, контакти й місце на карті.`
})

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: () => place.value?.photo ?? place.value?.logo,
  ogUrl: () => `${siteUrl}${route.path}`,
})

useHead({
  link: [{rel: 'canonical', href: () => `${siteUrl}${route.path}`}],
})
</script>

<template>
  <ClientOnly>
    <MapView/>

    <template #fallback>
      <MenuWrapper :place="place"/>
    </template>
  </ClientOnly>
</template>
