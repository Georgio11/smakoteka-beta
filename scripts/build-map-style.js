/* Стиль підкладки. Основа — OpenFreeMap Bright, поверх неї дві наші правки.
 *
 * Перша: викидаємо всі шари з їхніми точками. Заклади там з того самого OSM,
 * що й наші бандли, тобто ми малювали б ті самі кафе двічі — їхньою іконкою
 * і своєю. Зупинки й станції прибрані разом з ними: на карті лишаються тільки
 * наші мітки, все інше — вулиці й підписи.
 *
 * Друга: підписи однією українською. У Bright вони подвійні — «Kyiv Київ»,
 * латиниця плюс місцева назва в один рядок.
 *
 * Використання:
 *   npm run build:style
 */

import { writeFile, mkdir } from 'node:fs/promises'

const SOURCE = 'https://tiles.openfreemap.org/styles/bright'
const OUT_DIR = './public/map'
const OUT = `${OUT_DIR}/style.json`

const DROP_LAYERS = ['poi_r1', 'poi_r7', 'poi_r20', 'poi_transit']

/* Порядок важливий: `name:uk` є не скрізь, а `name` в українських тайлах уже
 * український. Латиниця — останній рятунок, щоб підпис не зник зовсім. */
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

let relabelled = 0

for (const layer of style.layers) {
    const field = layer.layout?.['text-field']

    if (!isDualName(field)) continue

    layer.layout['text-field'] = LABEL
    relabelled += 1
}

await mkdir(OUT_DIR, { recursive: true })
await writeFile(OUT, JSON.stringify(style))

console.log(`шарів ${total} -> ${style.layers.length}, підписів переписано ${relabelled}`)
console.log(`Записано ${OUT}`)

/** Подвійний підпис пізнається по звірці з `name:nonlatin` — саме вона вмикає
 *  склеювання латиниці з місцевою назвою. Підписи доріг (`ref`) не чіпаємо. */
function isDualName(field) {
    return Array.isArray(field) && JSON.stringify(field).includes('name:nonlatin')
}
