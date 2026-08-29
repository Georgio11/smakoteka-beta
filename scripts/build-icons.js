import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import subsetFont from 'subset-font'

const WEBFONTS = './node_modules/@fortawesome/fontawesome-free/webfonts'
const FONT_DIR = './src/assets/fonts'
const CSS_OUT = './src/assets/styles/_icons.scss'
const FAMILY = 'Smakoteka Icons'
const BRANDS_FAMILY = 'Smakoteka Brands'

const ICONS = {
    'mug-saucer': 'f0f4',
    'utensils': 'f2e7',
    'martini-glass': 'f57b',
    'beer-mug-empty': 'f0fc',
    'burger': 'f805',
    'location-crosshairs': 'f601',
    'circle-question': 'f059',
    'wheelchair': 'f193',
    'map-pin': 'f276',
    'arrow-up-right-from-square': 'f08e',
    'map': 'f279',
    'circle-user': 'f2bd',
    'magnifying-glass': 'f002',
    'check': 'f00c',
    'bookmark': 'f02e',
    'copy': 'f0c5',
    'arrow-left': 'f060',
    'face-meh': 'f11a',
    'face-smile': 'f118',
    'face-smile-beam': 'f5b8',
    'phone': 'f095',
    'earth-americas': 'f57c',
    'clock': 'f017',
    'chevron-down': 'f078',
    'chevron-up': 'f077',
    'seedling': 'f4d8',
    'border-all': 'f84c',
    'sun': 'f185',
}

const BRANDS = {
    'instagram': 'f16d',
    'facebook-f': 'f39e',
    'x-twitter': 'e61b',
    'telegram': 'f2c6',
    'tiktok': 'e07b',
    'youtube': 'f167',
}

const REGULAR = new Set(['face-meh', 'face-smile', 'face-smile-beam', 'copy', 'bookmark', 'clock'])

const solidNames = Object.keys(ICONS)
const regularNames = [...REGULAR]

await mkdir(FONT_DIR, { recursive: true })

const solid = await cut('fa-solid-900.woff2', solidNames, ICONS, 'icons.woff2')
const regular = await cut('fa-regular-400.woff2', regularNames, ICONS, 'icons-regular.woff2')
const brands = await cut('fa-brands-400.woff2', Object.keys(BRANDS), BRANDS, 'icons-brands.woff2')

await writeFile(CSS_OUT, css())

console.log(`solid: ${solidNames.length} іконок -> ${(solid / 1024).toFixed(1)} КБ`)
console.log(`regular: ${regularNames.length} іконок -> ${(regular / 1024).toFixed(1)} КБ`)
console.log(`brands: ${Object.keys(BRANDS).length} іконок -> ${(brands / 1024).toFixed(1)} КБ`)
console.log(`Записано ${FONT_DIR}/ і ${CSS_OUT}`)

await reportMissing()

async function cut(sourceFile, names, codes, outFile) {
    const source = await readFile(`${WEBFONTS}/${sourceFile}`)
    const glyphs = names.map((name) => String.fromCodePoint(parseInt(codes[name], 16))).join('')
    const subset = await subsetFont(source, glyphs, { targetFormat: 'woff2' })

    await writeFile(`${FONT_DIR}/${outFile}`, subset)

    return subset.length
}

function css() {
    const rules = Object.entries({ ...ICONS, ...BRANDS })
        .map(([name, code]) => `.fa-${name}::before {\n  content: '\\${code}';\n}`)
        .join('\n\n')

    return `/* Згенеровано scripts/build-icons.js — руками не правити.
 * Іконки: Font Awesome Free, CC BY 4.0. Шрифт: SIL OFL 1.1, підмножина. */

@font-face {
  font-family: '${FAMILY}';
  font-style: normal;
  font-weight: 900;
  font-display: block;
  src: url('../fonts/icons.woff2') format('woff2');
}

@font-face {
  font-family: '${FAMILY}';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('../fonts/icons-regular.woff2') format('woff2');
}

@font-face {
  font-family: '${BRANDS_FAMILY}';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('../fonts/icons-brands.woff2') format('woff2');
}

.fa-solid,
.fa-regular,
.fa-brands {
  display: inline-block;
  font-style: normal;
  font-variant: normal;
  line-height: 1;
  text-rendering: auto;
  -webkit-font-smoothing: antialiased;
}

.fa-solid,
.fa-regular {
  font-family: '${FAMILY}';
}

.fa-solid {
  font-weight: 900;
}

.fa-regular {
  font-weight: 400;
}

.fa-brands {
  font-family: '${BRANDS_FAMILY}';
  font-weight: 400;
}

${rules}
`
}

async function reportMissing() {
    const files = await readdir('./src', { recursive: true })
    const used = new Set()
    const wrongWeight = new Set()

    for (const file of files) {
        if (!/\.(vue|js)$/.test(file)) continue

        const text = await readFile(`./src/${file}`, 'utf8')

        for (const [, name] of text.matchAll(/\bfa-([a-z0-9-]+)/g)) {
            if (!['solid', 'regular', 'brands'].includes(name)) used.add(name)
        }

        for (const [, name] of text.matchAll(/fa-regular"[^>]*?fa-([a-z0-9-]+)/g)) {
            if (!REGULAR.has(name)) wrongWeight.add(`fa-regular fa-${name}`)
        }

        for (const [, name] of text.matchAll(/fa-brands"[^>]*?fa-([a-z0-9-]+)/g)) {
            if (!(name in BRANDS)) wrongWeight.add(`fa-brands fa-${name}`)
        }

        for (const [, name] of text.matchAll(/fa-solid"[^>]*?fa-([a-z0-9-]+)/g)) {
            if (name in BRANDS) wrongWeight.add(`fa-solid fa-${name}`)
        }
    }

    const missing = [...used].filter((name) => !(name in ICONS) && !(name in BRANDS)).sort()

    if (missing.length) {
        console.log(`\nУ шаблонах є, у шрифті немає: ${missing.join(', ')}`)
        console.log('Додай рядок у ICONS (або BRANDS) і запусти ще раз — інакше іконка не намалюється.')
    }

    if (wrongWeight.size) {
        console.log(`\nНе та родина або вага: ${[...wrongWeight].sort().join(', ')}`)
        console.log('Або поправ клас у шаблоні, або перекинь імʼя в/з REGULAR.')
    }
}
