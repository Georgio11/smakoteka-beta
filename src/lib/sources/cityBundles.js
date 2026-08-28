import { TILE_ZOOM, parseTileKey, tileForPoint, tileToBbox } from '@/lib/tiles'

const BASE = `${import.meta.env.BASE_URL}places`

let manifestPromise = null
const bundlePromises = new Map()
const uidIndexes = new Map()

export function loadManifest() {
    manifestPromise ??= fetch(`${BASE}/index.json`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => (Array.isArray(data?.bundles) ? data : { bundles: [] }))
        .catch(() => ({ bundles: [] }))

    return manifestPromise
}

export async function listCities() {
    const { bundles } = await loadManifest()

    return bundles.map(({ id, title, confirmed, updatedAt }) => ({
        id,
        title,
        places: confirmed ?? 0,
        updatedAt,
    }))
}

export async function boxOf(id) {
    const { bundles } = await loadManifest()
    return bundles.find((bundle) => bundle.id === id)?.bbox ?? null
}

export async function tilesOf(key, signal) {
    const bundle = await bundleForTile(key)

    if (!bundle) return null

    return loadBundle(bundle, signal)
}

export async function placeByUid(cityId, uid) {
    const { bundles } = await loadManifest()
    const bundle = bundles.find((item) => item.id === cityId)

    if (!bundle) return null

    const byTile = await loadBundle(bundle)

    let index = uidIndexes.get(cityId)

    if (!index) {
        index = new Map()

        for (const places of byTile.values()) {
            for (const place of places) index.set(place.uid, place)
        }

        uidIndexes.set(cityId, index)
    }

    return index.get(uid) ?? null
}

async function bundleForTile(key) {
    const { z, x, y } = parseTileKey(key)
    const tile = tileToBbox(x, y, z)
    const { bundles } = await loadManifest()

    return bundles.find(
        (bundle) => inside(tile, bundle.bbox) && !(bundle.holes ?? []).some((hole) => overlaps(tile, hole)),
    )
}

function loadBundle(bundle, signal) {
    let promise = bundlePromises.get(bundle.id)

    if (!promise) {
        promise = fetch(`${BASE}/${bundle.file}?v=${bundle.version}`, { signal })
            .then((response) => {
                if (!response.ok) throw new Error(`bundle ${bundle.id}: ${response.status}`)

                return response.json()
            })
            .then((places) => {
                if (!Array.isArray(places)) throw new Error(`bundle ${bundle.id}: not a list`)

                return bucket(places)
            })
            .catch((err) => {
                bundlePromises.delete(bundle.id)
                throw err
            })

        bundlePromises.set(bundle.id, promise)
    }

    return promise
}

function bucket(places) {
    const byTile = new Map()

    for (const place of places) {
        const key = tileForPoint(place.lat, place.lng, TILE_ZOOM)
        const list = byTile.get(key)

        if (list) list.push(place)
        else byTile.set(key, [place])
    }

    return byTile
}

function inside(tile, [south, west, north, east]) {
    return tile.south >= south && tile.north <= north && tile.west >= west && tile.east <= east
}

function overlaps(tile, [south, west, north, east]) {
    return tile.south < north && tile.north > south && tile.west < east && tile.east > west
}

const cityLists = new Map()

export async function placesOf(cityId) {
    const {bundles} = await loadManifest()
    const bundle = bundles.find((item) => item.id === cityId)

    if (!bundle) return []

    const byTile = await loadBundle(bundle)

    let list = cityLists.get(cityId)

    if (!list) {
        list = [...byTile.values()].flat()
        cityLists.set(cityId, list)
    }

    return list
}
