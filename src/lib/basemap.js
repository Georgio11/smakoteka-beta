const BASE = new URL(import.meta.env.BASE_URL, location.origin).href
const STYLE = `${BASE}map/style.json`

export async function basemapStyle() {
    const style = await fetch(STYLE).then((response) => {
        if (!response.ok) throw new Error(`style.json: ${response.status}`)

        return response.json()
    })

    style.sprite = `${BASE}${style.sprite}`
    style.glyphs = `${BASE}${style.glyphs}`

    return style
}
