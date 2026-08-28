<script setup>
import {computed, onMounted, onUnmounted, ref, shallowRef, watch, watchEffect} from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {maplibreGL} from '@maplibre/maplibre-gl-leaflet'
import 'maplibre-gl/dist/maplibre-gl.css'
import {usePlacesNearby} from '@/composables/usePlacesNearby'
import {useCity} from '@/composables/useCity'
import {useSelectedPlace} from '@/composables/useSelectedPlace'
import {useMapTab} from '@/composables/useMapTab'
import {useMapCount} from '@/composables/useMapCount'
import {kindMarkerHtml} from '@/components/map/kinds'
import {escapeHtml} from '@/lib/html'
import {cityBox, cityPlaces, placeByUid} from '@/lib/placesRepo'
import MapFilters from '@/components/map/MapFilters.vue'
import Tooltip from '@/components/ui/Tooltip.vue'
import MapLoader from '@/components/ui/MapLoader.vue'
import MenuWrapper from "@/components/menu/MenuWrapper.vue";

const FALLBACK_CENTER = [50.4501, 30.5234]
const DEFAULT_ZOOM = 15
const LOCATED_ZOOM = 16
const MIN_ZOOM = 12
const MAX_ZOOM = 20
const PLACE_ZOOM = 16
const COVERAGE_PAD = 0.04
const PAN_SLACK = 0.25
const MOVE_DEBOUNCE = 250
const READY_FALLBACK = 12000
const DOT_SIZE = 30
const CLUSTER_CELL = 68
const CLUSTER_UNTIL_ZOOM = 16

const LOCATE_TIP = 'Покажемо, де ти зараз. Браузер спитає дозвіл — без нього нічого не вийде.'
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)')

const container = ref(null)
const map = shallowRef(null)
const userMarker = shallowRef(null)
const poiLayer = shallowRef(null)
const isLocating = ref(false)
const filters = ref({kinds: [], stepFree: false, unconfirmedOnly: false})
const isOutsideCity = ref(false)
const cityList = shallowRef([])

const cityBounds = shallowRef(null)
const isReady = ref(false)
const isTiling = ref(false)
const {city} = useCity()
const {places, isLoading, error, loadBounds} = usePlacesNearby()
const {uid, selectPlace, closePlace} = useSelectedPlace()
const {resetTab} = useMapTab()
const {shown} = useMapCount()
const selected = shallowRef(null)

/* `places` тримає лише те, що у видимій області, тому шукати вибраний заклад
   там можна рівно один раз. Далі його треба тримати: інакше відвів карту —
   заклад вийшов із box — і картка зникла, хоча `?place=` в адресі лишився. */
async function resolveSelected() {
  if (!uid.value) {
    selected.value = null
    return
  }

  if (selected.value?.uid === uid.value) return

  const wanted = uid.value
  const nearby = places.value.find((place) => place.uid === wanted)

  if (nearby) {
    selected.value = nearby
    return
  }

  const fromBundle = city.value ? await placeByUid(city.value, wanted) : null

  if (uid.value === wanted) selected.value = fromBundle
}

watch([places, uid], resolveSelected, {immediate: true})

const layers = new Map()

const statusText = computed(() => {
  if (error.value) return error.value
  if (isOutsideCity.value) return 'Ти зараз не в цьому місті'
  if (isLoading.value) return 'Шукаю місця…'
  if (isTiling.value) return 'Довантажуємо карту…'

  return ''
})

let moveTimer = null

/* Прийшли по посиланню на заклад — людина не бачила попереднього стану карти,
   тож переліт їй нічого не показує. Гірше: він накладається на fitBounds, і
   цей конфлікт видно як «іноді працює». */
let arriving = Boolean(uid.value)

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
      html: '<i class="fa-solid fa-map-pin user-pin" aria-hidden="true"></i>',
      /* Вістря шпильки внизу посередині — туди й ставимо якір, інакше мітка
         вказувала б на місце вище за реальне. */
      iconSize: [22, 26],
      iconAnchor: [11, 26],
    }),
    interactive: false,
    zIndexOffset: 1000,
  }).addTo(map.value)
}

function locate({recenter = true} = {}) {
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

        if (recenter) map.value?.setView([coords.latitude, coords.longitude], LOCATED_ZOOM)
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

const shownCount = computed(() => cityList.value.filter(passesFilters).length)

watchEffect(() => {
  shown.value = shownCount.value
})


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
  const chosen = selected.value

  /* Вибраний береться зі `selected`, а не зі списку: він мусить лишатись на
     карті, навіть коли вийшов за межі завантаженої області. Заодно в кластер
     він не потрапляє — людина дивиться на його картку. */
  const pinned = chosen
      ? [{key: `p:${chosen.id}`, place: chosen, latlng: [chosen.lat, chosen.lng]}]
      : []

  const list = places.value.filter(
      (place) => place.uid !== chosen?.uid && passesFilters(place),
  )

  if (zoom >= CLUSTER_UNTIL_ZOOM) {
    return [
      ...pinned,
      ...list.map((place) => ({
        key: `p:${place.id}`,
        place,
        latlng: [place.lat, place.lng],
      })),
    ]
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

  return [...pinned, ...[...cells.values()].map((cell) => {
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
  })]
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

  const on = item.place.uid === uid.value ? ' poi-dot--on' : ''

  return L.marker(item.latlng, {
    icon: L.divIcon({
      className: '',
      html: `<div class="poi-dot poi-dot--${item.place.kind}${on}"><span class="poi-dot__icon">${kindMarkerHtml(item.place.kind)}</span><span class="poi-dot__name">${escapeHtml(item.place.name)}</span></div>`,
      iconSize: [DOT_SIZE, DOT_SIZE],
    }),
    keyboard: false,
  }).on('click', () => {
    selectPlace(item.place.uid)
  })
}

function highlight(place, on) {
  if (!place) return

  const dot = layers.get(`p:${place.id}`)?.getElement()?.querySelector('.poi-dot')

  dot?.classList.toggle('poi-dot--on', on)
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
  map.value.fitBounds(cityBounds.value, {animate: false})

  locate({recenter: !uid.value})
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
watch(filters, () => {
  if (uid.value) resetTab()
  closePlace()
  renderItems()
})


watch(isLoading, (busy) => {
  if (!busy) markReady('places')
})
watch(city, (id) => {
  if (id) enterCity(id)
})

watch(selected, (place, before) => {
  /* Набір міток залежить від вибору: щойно вибраний виходить із кластера,
     а колишній — вертається в нього. Без перебудови це побачив би лише
     наступний рух карти. */
  renderItems()

  highlight(before, false)
  highlight(place, true)

  if (!place) return

  const jump = arriving || REDUCED_MOTION.matches

  arriving = false

  map.value?.flyTo([place.lat, place.lng], PLACE_ZOOM, {
    duration: 0.8,
    animate: !jump,
  })
})

watch(city, async (id) => {
  const wanted = id
  const list = id ? await cityPlaces(id) : []

  if (city.value === wanted) cityList.value = list
}, {immediate: true})

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
    attributionControl: {
      customAttribution:
          '© OpenStreetMap contributors · © Overture Maps · OpenFreeMap · OpenMapTiles',
    },
  }).addTo(map.value)

  const gl = basemap.getMaplibreMap()

  gl.once('idle', () => markReady('style'))

  gl.on('idle', () => {
    isTiling.value = false
  })

  poiLayer.value = L.layerGroup().addTo(map.value)

  map.value.on('moveend', onMapMove)
  map.value.on('zoomend', onMapMove)
  map.value.on('resize', applyPanBounds)
  map.value.on('click', closePlace)
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
  <div class="map-canvas">
    <div ref="container" class="map-canvas__viewport"></div>

    <div v-if="statusText" class="map-canvas__status" :class="{ 'map-canvas__status--error': error }">
      {{ statusText }}
    </div>

    <Transition name="loader">
      <MapLoader v-if="!isReady"/>
    </Transition>

    <MapFilters v-model="filters"/>

    <Tooltip class="map-canvas__locate" :text="LOCATE_TIP" side="top">
      <button
          class="btn map-canvas__locate-btn"
          :class="{ 'map-canvas__locate-btn--busy': isLocating }"
          aria-label="Моє місце"
          @click="locate()"
      >
        <i class="fa-solid fa-location-crosshairs"></i>
      </button>
    </Tooltip>
    <MenuWrapper :place="selected" @close="closePlace"/>
  </div>
</template>

<style scoped>
.map-canvas {
  position: absolute;
  inset: 0;
}

.map-canvas__viewport {
  position: absolute;
  inset: 0 0 0 var(--panel-w);
  z-index: var(--z-map);
}

.map-canvas__status {
  position: absolute;
  top: var(--pad);
  left: var(--pad);
  z-index: var(--z-ui);
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-pill);
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-1);
  font-size: 13px;
  color: var(--ink-2);
  white-space: nowrap;
}

.map-canvas__status--error {
  color: var(--plum);
  background: var(--plum-bg);
  border-color: var(--plum-bg);
}

.map-canvas__locate {
  position: absolute;
  right: var(--pad);
  bottom: var(--pad);
  z-index: var(--z-ui);
}

.map-canvas__locate-btn {
  padding: var(--s-3);
  font-size: 18px;
  color: var(--ink-2);
}

.map-canvas__locate-btn--busy {
  opacity: 0.5;
}
</style>
