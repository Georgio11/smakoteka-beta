<script setup>
import {computed, onMounted, onUnmounted, ref, shallowRef, watch} from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {maplibreGL} from '@maplibre/maplibre-gl-leaflet'
import 'maplibre-gl/dist/maplibre-gl.css'
import {usePlacesNearby} from '@/composables/usePlacesNearby'
import {useCity} from '@/composables/useCity'
import {kindLabel, kindMarkerHtml} from '@/components/map/kinds'
import {escapeHtml} from '@/lib/html'
import {cityBox} from '@/lib/placesRepo'
import MapFilters from '@/components/map/MapFilters.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import MapLoader from '@/components/ui/MapLoader.vue'

const FALLBACK_CENTER = [50.4501, 30.5234]
const DEFAULT_ZOOM = 15
const LOCATED_ZOOM = 16
const MIN_ZOOM = 12
const MAX_ZOOM = 20
const COVERAGE_PAD = 0.04
const PAN_SLACK = 0.25
const MOVE_DEBOUNCE = 250
const READY_FALLBACK = 12000
const DOT_SIZE = 30
const CLUSTER_CELL = 68
const CLUSTER_UNTIL_ZOOM = 16

const LOCATE_TIP = 'Покажемо, де ви зараз. Браузер спитає дозвіл — без нього нічого не вийде.'

const container = ref(null)
const map = shallowRef(null)
const userMarker = shallowRef(null)
const poiLayer = shallowRef(null)
const isLocating = ref(false)
const filters = ref({kinds: [], stepFree: false, unconfirmedOnly: false})
const isOutsideCity = ref(false)
const selected = shallowRef(null)
const cityBounds = shallowRef(null)
const isReady = ref(false)
const isTiling = ref(false)
const {city} = useCity()
const {places, isLoading, error, loadBounds} = usePlacesNearby()

const layers = new Map()

const statusText = computed(() => {
  if (error.value) return error.value
  if (isOutsideCity.value) return 'Ти зараз не в цьому місті'
  if (isLoading.value) return 'Шукаю місця…'
  if (isTiling.value) return 'Довантажуємо карту…'

  return ''
})

let moveTimer = null

/* ---------- geolocation ---------- */

function showUser(lat, lng) {
  if (!map.value) return

  if (userMarker.value) {
    userMarker.value.setLatLng([lat, lng])
    return
  }

  userMarker.value = L.marker([lat, lng], {
    icon: L.divIcon({
      className: '',
      html: '<div class="user-dot"></div>',
      iconSize: [16, 16],
    }),
    interactive: false,
    zIndexOffset: 1000,
  }).addTo(map.value)
}

function locate() {
  if (!navigator.geolocation) return

  isLocating.value = true

  navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        isLocating.value = false

        const bounds = cityBounds.value

        if (bounds && !bounds.contains([coords.latitude, coords.longitude])) {
          isOutsideCity.value = true
          return
        }

        isOutsideCity.value = false
        showUser(coords.latitude, coords.longitude)
        map.value?.setView([coords.latitude, coords.longitude], LOCATED_ZOOM)
      },
      (err) => {
        isLocating.value = false
        console.warn('Geolocation failed:', err.message)
      },
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 30000},
  )
}

/* ---------- filter ---------- */

function passesFilters(place) {
  const {kinds, stepFree, unconfirmedOnly} = filters.value
  if (kinds.length && !kinds.includes(place.kind)) return false
  if (stepFree && place.wheelchair !== 'yes') return false
  // TEMPORARY: the chip swaps between two disjoint sets — confirmed by default,
  // unconfirmed on demand. Meant for inspection until we rank places by zoom.
  if (unconfirmedOnly ? place.confirmed : !place.confirmed) return false
  return true
}


/* ---------- готовність ---------- */

let hasStyle = false
let hasPlaces = false
let readyTimer = null

function markReady(what) {
  if (what === 'style') hasStyle = true
  if (what === 'places') hasPlaces = true

  if (!hasStyle || !hasPlaces) return

  clearTimeout(readyTimer)
  isReady.value = true
}

/* Шторка не має права висіти вічно: якщо тайли або бандл не приїхали,
   через READY_FALLBACK показуємо те, що є. Порожня карта чесніша за
   нескінченне очікування. */
function armReadyFallback() {
  clearTimeout(readyTimer)
  readyTimer = setTimeout(() => {
    isReady.value = true
    isTiling.value = true
  }, READY_FALLBACK)
}

/* ---------- clustering ---------- */

function buildItems() {
  const instance = map.value
  if (!instance) return []

  const zoom = instance.getZoom()
  const list = places.value.filter(passesFilters)

  if (zoom >= CLUSTER_UNTIL_ZOOM) {
    return list.map((place) => ({
      key: `p:${place.id}`,
      place,
      latlng: [place.lat, place.lng],
    }))
  }

  const cells = new Map()

  for (const place of list) {
    const point = instance.project([place.lat, place.lng], zoom)
    const cellX = Math.floor(point.x / CLUSTER_CELL)
    const cellY = Math.floor(point.y / CLUSTER_CELL)
    const cellKey = `${cellX}:${cellY}`
    const cell = cells.get(cellKey)

    if (cell) {
      cell.places.push(place)
      cell.latSum += place.lat
      cell.lngSum += place.lng
    } else {
      cells.set(cellKey, {cellKey, places: [place], latSum: place.lat, lngSum: place.lng})
    }
  }

  return [...cells.values()].map((cell) => {
    const count = cell.places.length

    if (count === 1) {
      const [place] = cell.places

      return {key: `p:${place.id}`, place, latlng: [place.lat, place.lng]}
    }

    return {
      key: `c:${cell.cellKey}:${count}`,
      count,
      places: cell.places,
      latlng: [cell.latSum / count, cell.lngSum / count],
    }
  })
}

function googleMapsUrl(place) {
  const query = `${place.lat},${place.lng}`
  return place.gid
      ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${place.gid}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`
}

/* ---------- render ---------- */

function markerFor(item) {
  if (item.count) {
    const size = item.count > 99 ? 40 : 32

    return L.marker(item.latlng, {
      icon: L.divIcon({
        className: '',
        html: `<div class="cluster-dot" style="width:${size}px;height:${size}px">${item.count > 999 ? '999+' : item.count}</div>`,
        iconSize: [size, size],
      }),
      zIndexOffset: 200,
    }).on('click', () => zoomToCluster(item))
  }

  return L.marker(item.latlng, {
    icon: L.divIcon({
      className: '',
      html: `<div class="poi-dot poi-dot--${item.place.kind}"><span class="poi-dot__icon">${kindMarkerHtml(item.place.kind)}</span><span class="poi-dot__name">${escapeHtml(item.place.name)}</span></div>`,
      iconSize: [DOT_SIZE, DOT_SIZE],
    }),
    keyboard: false,
  }).on('click', () => {
    selected.value = item.place
  })
}

function renderItems() {
  if (!poiLayer.value) return

  const desired = new Map(buildItems().map((item) => [item.key, item]))

  for (const [key, marker] of layers) {
    if (desired.has(key)) continue

    poiLayer.value.removeLayer(marker)
    layers.delete(key)
  }

  for (const [key, item] of desired) {
    if (layers.has(key)) continue

    const marker = markerFor(item)

    marker.addTo(poiLayer.value)
    layers.set(key, marker)
  }
}

function zoomToCluster(item) {
  const bounds = L.latLngBounds(item.places.map((place) => [place.lat, place.lng]))

  map.value?.fitBounds(bounds.pad(0.2), {maxZoom: CLUSTER_UNTIL_ZOOM})
}

/* ---------- coverage ---------- */

async function enterCity(id) {
  const box = await cityBox(id)

  if (!box || !map.value) return

  /* Нове місто — нові дані, тож шторка повертається: інакше при перемиканні
     людина дивилась би на чужі мітки, поки приїдуть свої. */
  hasPlaces = false
  isReady.value = false
  armReadyFallback()

  const [south, west, north, east] = box

  cityBounds.value = L.latLngBounds([south, west], [north, east]).pad(COVERAGE_PAD)

  applyPanBounds()
  map.value.fitBounds(cityBounds.value)

  locate()
  loadPlaces()
}


function applyPanBounds() {
  const instance = map.value
  const covered = cityBounds.value

  if (!instance || !covered) return

  const pan = L.latLngBounds(covered.getSouthWest(), covered.getNorthEast())
      .extend(viewAt(MIN_ZOOM, covered.getCenter()))
      .pad(PAN_SLACK)

  instance.setMaxBounds(pan)
}

function viewAt(zoom, center) {
  const instance = map.value
  const size = instance.getSize()
  const point = instance.project(center, zoom)

  return L.latLngBounds(
      instance.unproject(point.add([-size.x / 2, size.y / 2]), zoom),
      instance.unproject(point.add([size.x / 2, -size.y / 2]), zoom),
  )
}

/* ---------- loading ---------- */

async function loadPlaces() {
  const instance = map.value
  if (!instance) return

  await loadBounds(instance.getBounds())

  renderItems()
}

function onMapMove() {
  clearTimeout(moveTimer)
  moveTimer = setTimeout(loadPlaces, MOVE_DEBOUNCE)
  renderItems()
}

watch(places, renderItems)
watch(filters, renderItems)

/* Момент готовності — коли доїхало саме останнє завантаження. Раніше шторка
   знімалась одразу після першого `await loadPlaces()`, а `fitBounds` встигав
   зрушити карту й запустити друге, яке скасовувало перше. Тобто ми чекали на
   запит, який сам себе відмінив, і показували порожню карту. */
watch(isLoading, (busy) => {
  if (!busy) markReady('places')
})
watch(city, (id) => {
  if (id) enterCity(id)
})



/* ---------- lifecycle ---------- */

onMounted(() => {
  map.value = L.map(container.value, {
    center: FALLBACK_CENTER,
    zoom: DEFAULT_ZOOM,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxBoundsViscosity: 1,
    zoomControl: false,
  })

  const basemap = maplibreGL({
    style: `${import.meta.env.BASE_URL}map/style.json`,
  }).addTo(map.value)

  const gl = basemap.getMaplibreMap()

  gl.once('idle', () => markReady('style'))

  /* Тайли догружаються й після того, як шторка злетіла достроково. Поки це
     триває, чесніше сказати про це рядком, ніж малювати мітки на порожнечі. */
  gl.on('idle', () => {
    isTiling.value = false
  })

  poiLayer.value = L.layerGroup().addTo(map.value)

  map.value.on('moveend', onMapMove)
  map.value.on('zoomend', onMapMove)
  map.value.on('resize', applyPanBounds)
  armReadyFallback()

  if (city.value) enterCity(city.value)
})

onUnmounted(() => {
  clearTimeout(moveTimer)
  clearTimeout(readyTimer)
  map.value?.remove()
  map.value = null
  userMarker.value = null
  poiLayer.value = null
  layers.clear()
})
</script>

<template>
  <div class="map-wrap">
    <div ref="container" class="map-canvas"></div>

    <div v-if="statusText" class="map-status" :class="{ 'is-error': error }">
      {{ statusText }}
    </div>

    <Transition name="loader">
      <MapLoader v-if="!isReady"/>
    </Transition>

    <MapFilters v-model="filters"/>

    <Tooltip class="locate-slot" :text="LOCATE_TIP" side="top">
      <button
          class="locate-btn"
          :class="{ 'is-busy': isLocating }"
          aria-label="Моє місце"
          @click="locate"
      >
        <i class="fa-solid fa-location-crosshairs"></i>
      </button>
    </Tooltip>

    <div v-if="selected" class="place-card">
      <div class="place-card__name">{{ selected.name }}</div>
      <div class="place-card__meta">
        {{ kindLabel(selected.kind) }}
        <template v-if="selected.address"> · {{ selected.address }}</template>
      </div>

      <a
          class="place-card__link"
          :href="googleMapsUrl(selected)"
          target="_blank"
          rel="noopener noreferrer"
      >
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        Показати на Google Maps
      </a>
      <button class="place-card__close" aria-label="Закрити" @click="selected = null">×</button>
    </div>
  </div>
</template>

<style scoped>
.loader-leave-active {
  transition: opacity 0.45s var(--ease);
}

.loader-leave-to {
  opacity: 0;
}

.map-wrap {
  position: absolute;
  inset: 0;
}

.map-canvas {
  position: absolute;
  inset: 0;
  z-index: var(--z-map);
}

.map-status {
  position: absolute;
  top: var(--pad);
  left: var(--pad);
  z-index: var(--z-ui);
  padding: 7px 14px;
  border-radius: 99px;
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
  font-size: 13px;
  color: var(--ink-2);
  white-space: nowrap;
}

.map-status.is-error {
  color: var(--plum);
  background: var(--plum-bg);
  border-color: var(--plum-bg);
}

.locate-slot {
  position: absolute;
  right: var(--pad);
  bottom: var(--pad);
  z-index: var(--z-ui);
}

.locate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: var(--r);
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
  font-size: 18px;
  color: var(--ink-2);
}

.locate-btn.is-busy {
  opacity: 0.5;
}

.place-card {
  position: absolute;
  left: var(--pad);
  right: calc(var(--pad) * 2 + 42px);
  bottom: var(--pad);
  z-index: var(--z-panel);
  padding: 12px 34px 12px 14px;
  border-radius: var(--r-lg);
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
}

.place-card__name {
  font-weight: 500;
}

.place-card__meta {
  font-size: 13px;
  color: var(--ink-3);
}

.place-card__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--plum);
  font-size: 13px;
  font-weight: 500;
}

@media (hover: hover) {
  .place-card__link:hover {
    text-decoration: underline;
  }
}

.place-card__close {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 20px;
  line-height: 1;
  color: var(--ink-3);
}
</style>
