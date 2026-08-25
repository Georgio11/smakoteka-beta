export const TILE_ZOOM = 14

const MAX_LAT = 85.0511

export function tileKey(x, y, z = TILE_ZOOM) {
    return `${z}/${x}/${y}`
}

export function parseTileKey(key) {
    const [z, x, y] = key.split('/').map(Number)
    return { z, x, y }
}

export function lngToTileX(lng, z = TILE_ZOOM) {
    return Math.floor(((lng + 180) / 360) * 2 ** z)
}

export function latToTileY(lat, z = TILE_ZOOM) {
    const clamped = Math.min(MAX_LAT, Math.max(-MAX_LAT, lat))
    const rad = (clamped * Math.PI) / 180
    const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad))

    return Math.floor(((1 - merc / Math.PI) / 2) * 2 ** z)
}

export function tileToBbox(x, y, z = TILE_ZOOM) {
    const n = 2 ** z

    return {
        south: tileYToLat(y + 1, n),
        west: (x / n) * 360 - 180,
        north: tileYToLat(y, n),
        east: ((x + 1) / n) * 360 - 180,
    }
}

export function tilesForBox({ south, west, north, east }, z = TILE_ZOOM) {
    const minX = lngToTileX(west, z)
    const maxX = lngToTileX(east, z)
    const minY = latToTileY(north, z)
    const maxY = latToTileY(south, z)

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const result = []

    for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
            result.push({ key: tileKey(x, y, z), x, y, z })
        }
    }

    return result.sort(
        (a, b) =>
            (a.x - centerX) ** 2 + (a.y - centerY) ** 2 -
            ((b.x - centerX) ** 2 + (b.y - centerY) ** 2),
    )
}

export function tileForPoint(lat, lng, z = TILE_ZOOM) {
    return tileKey(lngToTileX(lng, z), latToTileY(lat, z), z)
}

function tileYToLat(y, n) {
    const t = Math.PI * (1 - (2 * y) / n)

    return (180 / Math.PI) * Math.atan(Math.sinh(t))
}
