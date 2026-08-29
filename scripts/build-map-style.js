import { writeFile, mkdir, readFile } from 'node:fs/promises'

const SOURCE = 'https://tiles.openfreemap.org/styles/bright'
const OUT_DIR = './public/map'
const OUT = `${OUT_DIR}/style.json`

const DROP_LAYERS = ['poi_r1', 'poi_r7', 'poi_r20', 'poi_transit']

const SPRITE_DIR = `${OUT_DIR}/sprite`
const FONT_DIR = `${OUT_DIR}/fonts`
const FONT_SOURCE = 'https://tiles.openfreemap.org/fonts'
const FACES = ['Noto Sans Regular', 'Noto Sans Bold']
const DROP_FACE = 'Noto Sans Italic'
const KEEP_FACE = 'Noto Sans Regular'

const RANGES = ['0-255', '256-511', '512-767', '768-1023', '1024-1279', '1280-1535', '8192-8447']

const LABEL = ['coalesce', ['get', 'name:uk'], ['get', 'name'], ['get', 'name:latin']]

const response = await fetch(SOURCE, { headers: { 'user-agent': 'smakoteka-build' } })

if (!response.ok) {
    console.error(`${SOURCE}: ${response.status}`)
    process.exit(1)
}

const style = await response.json()
const total = style.layers.length

style.name = 'Смакотека'
style.layers = style.layers.filter((layer) => !DROP_LAYERS.includes(layer.id))

const base = (await readFile('./vite.config.js', 'utf8')).match(/base:\s*'([^']+)'/)?.[1] ?? '/'

style.glyphs = `${base}map/fonts/{fontstack}/{range}.pbf`

let relabelled = 0
let refonted = 0

for (const layer of style.layers) {
    const field = layer.layout?.['text-field']

    if (!isDualName(field)) continue

    layer.layout['text-field'] = LABEL
    relabelled += 1
}

let denulled = 0

for (const layer of style.layers) {
    if (!layer.filter || !JSON.stringify(layer.filter).includes('"capital"')) continue

    layer.filter = coalesceCapital(layer.filter)
    denulled += 1
}

for (const layer of style.layers) {
    const face = layer.layout?.['text-font']

    if (!Array.isArray(face) || !face.includes(DROP_FACE)) continue

    layer.layout['text-font'] = face.map((name) => (name === DROP_FACE ? KEEP_FACE : name))
    refonted += 1
}

await mkdir(SPRITE_DIR, { recursive: true })

for (const ext of ['json', 'png']) {
    const sprite = await fetch(`${style.sprite}.${ext}`)

    if (!sprite.ok) {
        console.error(`sprite.${ext}: ${sprite.status}`)
        process.exit(1)
    }

    await writeFile(`${SPRITE_DIR}/sprite.${ext}`, Buffer.from(await sprite.arrayBuffer()))
}

style.sprite = `${base}map/sprite/sprite`

await mkdir(FONT_DIR, { recursive: true })

let fontBytes = 0

for (const face of FACES) {
    await mkdir(`${FONT_DIR}/${face}`, { recursive: true })

    for (const range of RANGES) {
        const glyphs = await fetch(`${FONT_SOURCE}/${encodeURIComponent(face)}/${range}.pbf`)

        if (!glyphs.ok) {
            console.error(`${face} ${range}: ${glyphs.status}`)
            process.exit(1)
        }

        const body = Buffer.from(await glyphs.arrayBuffer())

        await writeFile(`${FONT_DIR}/${face}/${range}.pbf`, body)
        fontBytes += body.length
    }
}

await mkdir(OUT_DIR, { recursive: true })
await writeFile(OUT, JSON.stringify(style))

console.log(
    `шарів ${total} -> ${style.layers.length}, підписів переписано ${relabelled}, ` +
        `гарнітур замінено ${refonted}, фільтрів із capital полагоджено ${denulled}`,
)
console.log(`шрифтів забрано ${FACES.length * RANGES.length} файлів, ${(fontBytes / 1024).toFixed(0)} КБ`)
console.log(`Записано ${OUT}`)

function isDualName(field) {
    return Array.isArray(field) && JSON.stringify(field).includes('name:nonlatin')
}

function coalesceCapital(node) {
    if (!Array.isArray(node)) return node

    const [head, ...rest] = node

    if (head === 'get' && rest[0] === 'capital') return ['coalesce', node, 0]

    return [head, ...rest.map(coalesceCapital)]
}
