import { ref, shallowRef } from 'vue'
import { loadTile, primeIndex } from '@/lib/placesRepo'
import { TILE_ZOOM, tilesForBox } from '@/lib/tiles'

const MAX_TILES_PER_LOAD = 96
const MAX_KEPT_PLACES = 4000
const PAD = 0.15

export function usePlacesNearby() {
    const places = shallowRef([])
    const isLoading = ref(false)
    const error = ref(null)

    const byId = new Map()

    let controller = null
    let generation = 0

    async function loadBounds(bounds) {
        controller?.abort()
        controller = new AbortController()

        const { signal } = controller
        const gen = (generation += 1)
        const box = padBox(toBox(bounds), PAD)
        const tiles = tilesForBox(box, TILE_ZOOM).slice(0, MAX_TILES_PER_LOAD)

        error.value = null
        isLoading.value = tiles.length > 0

        primeIndex()

        let failed = 0

        await Promise.all(
            tiles.map(async ({ key }) => {
                try {
                    const tilePlaces = await loadTile(key, { signal })

                    if (gen !== generation) return

                    if (!tilePlaces) return

                    for (const place of tilePlaces) byId.set(place.id, place)

                    publish(box)
                } catch (err) {
                    if (err.name === 'AbortError' || gen !== generation) return

                    failed += 1
                    console.warn(`tile ${key}:`, err.message)
                }
            }),
        )

        if (gen !== generation) return

        isLoading.value = false
        publish(box)

        if (failed) {
            error.value =
                failed === tiles.length
                    ? 'Не вдалося завантажити місця'
                    : `Частина місць не завантажилась (${failed} з ${tiles.length})`
        }
    }

    function publish(box) {
        prune(box)

        places.value = [...byId.values()].filter((place) => inBox(place, box))
    }

    function prune(box) {
        if (byId.size <= MAX_KEPT_PLACES) return

        const wide = padBox(box, 2)

        for (const [id, place] of byId) {
            if (!inBox(place, wide)) byId.delete(id)
        }
    }

    return {
        places,
        isLoading,
        error,
        loadBounds,
    }
}

function toBox(bounds) {
    return {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
    }
}

function padBox({ south, west, north, east }, ratio) {
    const latPad = (north - south) * ratio
    const lngPad = (east - west) * ratio

    return {
        south: south - latPad,
        west: west - lngPad,
        north: north + latPad,
        east: east + lngPad,
    }
}

function inBox(place, { south, west, north, east }) {
    return place.lat >= south && place.lat <= north && place.lng >= west && place.lng <= east
}
