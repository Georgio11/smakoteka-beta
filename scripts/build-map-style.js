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
 * Третя: одна гарнітура замість трьох і шрифти до себе. Кожна гарнітура тягне
 * свої діапазони символів окремими файлами, і на першому заході це було 691 КБ
 * з чужого домену — більше за все інше разом. Italic лишався заради назв річок,
 * ціна невиправдана.
 *
 * Використання:
 *   npm run build:style
 */

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

/* Діапазони юнікоду, які потрібні українській карті: латиниця з цифрами,
 * латинське розширення, кирилиця, кирилиця-доповнення і типографські знаки
 * (тире, лапки). Решту браузер не попросить, тому й не тримаємо. */
const RANGES = ['0-255', '256-511', '512-767', '768-1023', '1024-1279', '1280-1535', '8192-8447']

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

/* Шлях мусить бути абсолютним. Відносний MapLibre розв'язує від адреси
 * сторінки, а не від файлу стилю, тому на `/kyiv/place/…` він поїхав би
 * шукати шрифти в неіснуючій теці. База береться з vite.config, щоб не
 * тримати її у двох місцях. */
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

for (const layer of style.layers) {
    const face = layer.layout?.['text-font']

    if (!Array.isArray(face) || !face.includes(DROP_FACE)) continue

    layer.layout['text-font'] = face.map((name) => (name === DROP_FACE ? KEEP_FACE : name))
    refonted += 1
}

/* Спрайти — це атлас іконок підкладки (щити доріг, аеропорт тощо) плюс json
 * з координатами. Статика на 75 КБ, тому теж переїжджає до нас: менше чужих
 * доменів у критичному шляху. */
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

console.log(`шарів ${total} -> ${style.layers.length}, підписів переписано ${relabelled}, гарнітур замінено ${refonted}`)
console.log(`шрифтів забрано ${FACES.length * RANGES.length} файлів, ${(fontBytes / 1024).toFixed(0)} КБ`)
console.log(`Записано ${OUT}`)

/** Подвійний підпис пізнається по звірці з `name:nonlatin` — саме вона вмикає
 *  склеювання латиниці з місцевою назвою. Підписи доріг (`ref`) не чіпаємо. */
function isDualName(field) {
    return Array.isArray(field) && JSON.stringify(field).includes('name:nonlatin')
}
