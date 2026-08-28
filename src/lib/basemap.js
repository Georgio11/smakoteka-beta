const STYLE = `${import.meta.env.BASE_URL}map/style.json`

export async function basemapStyle() {
    const style = await fetch(STYLE).then((response) => {
        if (!response.ok) throw new Error(`style.json: ${response.status}`)

        return response.json()
    })

    style.sprite = new URL(style.sprite, location.origin).href

    return style
}
