const ICONS = {
    cafe: 'fa-mug-saucer',
    restaurant: 'fa-utensils',
    bar: 'fa-martini-glass',
    pub: 'fa-beer-mug-empty',
    fast_food: 'fa-burger',
}

const LABELS = {
    cafe: 'Кафе',
    restaurant: 'Ресторани',
    bar: 'Бари',
    pub: 'Паби',
    fast_food: 'Фастфуд',
}

/** Клас іконки Font Awesome — звичайний випадок, іде у :class. */
export function kindIcon(kind) {
    return ICONS[kind] ?? ''
}

export function kindLabel(kind) {
    return LABELS[kind] ?? kind
}

/** Готова розмітка для L.divIcon: Leaflet приймає HTML рядком, а не вузлом. */
export function kindMarkerHtml(kind) {
    const icon = ICONS[kind]

    if (!icon) return ''

    return `<i class="fa-solid ${icon}" aria-hidden="true"></i>`
}

export const KINDS = Object.keys(ICONS)
