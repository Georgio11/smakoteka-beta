import * as bundles from '@/lib/sources/cityBundles'

const ABANDON_GRACE = 1500

const memory = new Map()
const inflight = new Map()

export function loadTile(key, { signal } = {}) {
    const cached = memory.get(key)

    if (cached) return Promise.resolve(cached)

    let entry = inflight.get(key)

    if (!entry) {
        const controller = new AbortController()

        entry = { controller, interest: 0, abandonTimer: null }
        entry.promise = fromSources(key, controller.signal).finally(() => {
            clearTimeout(entry.abandonTimer)

            if (inflight.get(key) === entry) inflight.delete(key)
        })

        inflight.set(key, entry)
    }

    return share(key, entry, signal)
}

export function primeIndex() {
    return bundles.loadManifest()
}

export function cities() {
    return bundles.listCities()
}

export function cityBox(id) {
    return bundles.boxOf(id)
}

export function placeByUid(cityId, uid) {
    return bundles.placeByUid(cityId, uid)
}

async function fromSources(key, signal) {
    const fromBundle = await bundles.tilesOf(key, signal)

    if (!fromBundle) return null

    for (const [tileKey, places] of fromBundle) memory.set(tileKey, places)

    return fromBundle.get(key) ?? []
}

function share(entryKey, entry, signal) {
    clearTimeout(entry.abandonTimer)
    entry.abandonTimer = null
    entry.interest += 1

    if (!signal) return entry.promise

    if (signal.aborted) {
        release()
        return Promise.reject(abortError(signal))
    }

    signal.addEventListener('abort', release, { once: true })
    entry.promise.then(cleanup, cleanup)

    return Promise.race([
        entry.promise,
        new Promise((_, reject) => {
            signal.addEventListener('abort', () => reject(abortError(signal)), { once: true })
        }),
    ])

    function release() {
        entry.interest -= 1

        if (entry.interest > 0 || entry.abandonTimer) return

        entry.abandonTimer = setTimeout(() => {
            if (entry.interest > 0) return

            if (inflight.get(entryKey) === entry) inflight.delete(entryKey)

            entry.controller.abort()
        }, ABANDON_GRACE)
    }

    function cleanup() {
        signal.removeEventListener('abort', release)
    }
}

function abortError(signal) {
    return signal.reason ?? new DOMException('Aborted', 'AbortError')
}
