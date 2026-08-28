/* Розбір `opening_hours` з OSM. Своя реалізація, а не бібліотека: після того
 * як пайплайн викинув усе нічне, з 2645 рядків складними лишаються десятки, і
 * заради них не варто везти в браузер календарі свят усіх країн світу.
 *
 * Підтримується те, що справді трапляється в наших даних:
 *   Mo-Su 12:00-22:00
 *   Mo-Fr 09:00-14:00,15:00-19:00
 *   Mo-Fr 07:30-19:00; Sa 09:00-18:30; Su off
 *   11:00-23:00                      без днів — отже щодня
 *   Mo-Su,PH 10:00-22:00             PH (свята) ігноруємо
 *
 * Розібрати не вдалось — повертається null, і картка показує рядок як є.
 * Це навмисно: краще сирий текст, ніж вигадані години. */

const DAY_CODES = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']

export const DAYS = [
    'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя',
]

export const DAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд']

const TIME_ZONE = 'Europe/Kyiv'

const SPAN = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/

/** Рядок -> сім наборів інтервалів, з понеділка. Кожен інтервал — хвилини від
 *  півночі: [[720, 1320]] це 12:00-22:00. Порожній набір — вихідний. */
export function parseHours(text) {
    if (!text) return null

    const week = Array.from({ length: 7 }, () => [])
    let touched = false

    /* «Su-We:11:00-22:00» — двокрапка замість пробілу після днів. Час чіпати не
       можна, тому дивимось саме на межу «літери -> цифри». */
    const normalized = text.replace(/([a-z]{2})\s*:\s*(?=\d)/gi, '$1 ')

    for (const part of normalized.split(';')) {
        /* Кома означає то одне, то інше: «Mo-Fr, Su 10:00-22:00» — перелік днів,
           «Mo-Fr 09:00-14:00,15:00-19:00» — другий інтервал того ж дня,
           «mo-fr 08:00-19:00, sa-su off» — взагалі окреме правило. Тому йдемо
           шматками й дивимось, що саме в кожному. */
        const chunks = part.split(',').map((chunk) => chunk.trim().replace(/\+$/, '')).filter(Boolean)

        /* Дні, які вже назвали, але часу для них ще не бачили. */
        let pending = []
        /* Дні останнього правила — до них чіпляється інтервал без днів. */
        let current = null

        for (const chunk of chunks) {
            const span = parseSpan(chunk)

            if (span) {
                if (current) {
                    for (const day of current) week[day].push(span)
                } else {
                    current = pending.length ? pending : EVERY_DAY
                    pending = []

                    for (const day of current) week[day] = [span]
                }

                touched = true
                continue
            }

            if (isClosed(chunk)) {
                current = pending.length ? pending : current ?? EVERY_DAY
                pending = []

                for (const day of current) week[day] = []

                touched = true
                continue
            }

            /* Дні й час в одному шматку: «Mo-Fr 09:00-18:00», «Su off». */
            const split = chunk.match(/^(\D+?)\s+(.+)$/)

            if (split) {
                const days = parseDays(split[1])

                if (!days) return null

                const all = [...pending, ...days]

                pending = []

                /* Самі лише свята — правила для них ми не показуємо. */
                if (!all.length) continue

                const rest = split[2].trim()

                if (isClosed(rest)) {
                    for (const day of all) week[day] = []
                } else {
                    const found = parseSpan(rest)

                    if (!found) return null

                    for (const day of all) week[day] = [found]
                }

                current = all
                touched = true
                continue
            }

            const days = parseDays(chunk)

            if (!days) return null

            pending.push(...days)
        }
    }

    return touched ? week : null
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

function isClosed(text) {
    return /^(off|closed)$/i.test(text.trim())
}

/** Порожній масив — тільки свята чи канікули, для нас це не день тижня.
 *  null — трапилось щось, чого ми не розуміємо, і краще не вгадувати. */
function parseDays(text) {
    const days = new Set()

    for (const item of text.trim().toLowerCase().split(/\s+/)) {
        if (!item) continue
        if (item === 'ph' || item === 'sh') continue

        const range = item.split('-').map((part) => DAY_CODES.indexOf(part.trim().slice(0, 2)))

        if (range.some((index) => index < 0)) return null

        const [from, to = from] = range

        for (let day = from; ; day = (day + 1) % 7) {
            days.add(day)

            if (day === to) break
        }
    }

    return [...days]
}

function parseSpan(text) {
    const found = text.trim().match(SPAN)

    if (!found) return null

    const [, fromHour, fromMinute, toHour, toMinute] = found.map(Number)

    return [fromHour * 60 + fromMinute, toHour * 60 + toMinute]
}

/** Котра година в Києві, а не в браузері: заклади всі тут, а людина може
 *  дивитись звідки завгодно. */
export function kyivNow(at = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(at)

    const value = (type) => parts.find((part) => part.type === type)?.value ?? ''
    const day = DAY_CODES.indexOf(value('weekday').toLowerCase().slice(0, 2))

    return { day, minutes: Number(value('hour')) * 60 + Number(value('minute')) }
}

/** Відчинено зараз — і до котрої; якщо ні — коли відчиниться найближчим часом. */
export function statusOf(week, now = kyivNow()) {
    const today = week[now.day] ?? []
    const open = today.find(([from, to]) => now.minutes >= from && now.minutes < to)

    if (open) return { isOpen: true, until: open[1] }

    for (let shift = 0; shift < 7; shift += 1) {
        const day = (now.day + shift) % 7

        for (const [from] of week[day] ?? []) {
            if (shift === 0 && from <= now.minutes) continue

            return { isOpen: false, opensDay: day, opensAt: from, shift }
        }
    }

    return { isOpen: false }
}

export function formatTime(minutes) {
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function formatSpans(spans) {
    if (!spans?.length) return null

    return spans.map(([from, to]) => `${formatTime(from)}–${formatTime(to)}`).join(', ')
}
