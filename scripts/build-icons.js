/* Підмножина Font Awesome. Повний solid важить 119 КБ і на 3G їде секунд пʼять,
 * хоча ми використовуємо з нього девʼять іконок. Скрипт вирізає саме їх і
 * заодно генерує стилі, щоб карта «клас -> символ» жила в одному місці.
 *
 * Родину перейменовано: шрифт FA роздається під SIL OFL, а модифікованій версії
 * не годиться лишати оригінальну назву.
 *
 * Використання:
 *   npm run build:icons
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import subsetFont from 'subset-font'

const SOURCE = './node_modules/@fortawesome/fontawesome-free/webfonts/fa-solid-900.woff2'
const FONT_OUT = './src/assets/fonts/icons.woff2'
const CSS_OUT = './src/assets/styles/_icons.scss'
const FAMILY = 'Smakoteka Icons'

/* Клас -> символ у шрифті. Додаєш іконку в шаблони — додаєш рядок сюди,
 * інакше в бандлі її просто не буде. Коди беруться з css/all.css пакета. */
const ICONS = {
    'mug-saucer': 'f0f4',
    'utensils': 'f2e7',
    'martini-glass': 'f57b',
    'beer-mug-empty': 'f0fc',
    'burger': 'f805',
    'location-crosshairs': 'f601',
    'circle-question': 'f059',
    'wheelchair': 'f193',
    'arrow-up-right-from-square': 'f08e',
}

const source = await readFile(SOURCE)
const glyphs = Object.values(ICONS).map((code) => String.fromCodePoint(parseInt(code, 16))).join('')

const subset = await subsetFont(source, glyphs, { targetFormat: 'woff2' })

await mkdir('./src/assets/fonts', { recursive: true })
await writeFile(FONT_OUT, subset)

const rules = Object.entries(ICONS)
    .map(([name, code]) => `.fa-${name}::before {\n  content: '\\${code}';\n}`)
    .join('\n\n')

await writeFile(
    CSS_OUT,
    `/* Згенеровано scripts/build-icons.js — руками не правити.
 * Іконки: Font Awesome Free, CC BY 4.0. Шрифт: SIL OFL 1.1, підмножина. */

@font-face {
  font-family: '${FAMILY}';
  font-style: normal;
  font-weight: 900;
  font-display: block;
  src: url('../fonts/icons.woff2') format('woff2');
}

.fa-solid {
  display: inline-block;
  font-family: '${FAMILY}';
  font-weight: 900;
  font-style: normal;
  font-variant: normal;
  line-height: 1;
  text-rendering: auto;
  -webkit-font-smoothing: antialiased;
}

${rules}
`,
)

console.log(`іконок ${Object.keys(ICONS).length}, шрифт ${(source.length / 1024).toFixed(0)} КБ -> ${(subset.length / 1024).toFixed(1)} КБ`)
console.log(`Записано ${FONT_OUT} і ${CSS_OUT}`)
