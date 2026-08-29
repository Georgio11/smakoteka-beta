const DAY_CODES = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']

export const DAYS = [
    'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя',
]

export const DAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд']

const TIME_ZONE = 'Europe/Kyiv'

const SPAN = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/

export function parseHours(text) {
    if (!text) return null

    const week = Array.from({ length: 7 }, () => [])
    let touched = false

    const normalized = text.replace(/([a-z]{2})\s*:\s*(?=\d)/gi, '$1 ')

    for (const part of normalized.split(';')) {

        const chunks = part.split(',').map((chunk) => chunk.trim().replace(/\+$/, '')).filter(Boolean)

        let pending = []

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

            const split = chunk.match(/^(\D+?)\s+(.+)$/)

            if (split) {
                const days = parseDays(split[1])

                if (!days) return null

                const all = [...pending, ...days]

                pending = []

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
