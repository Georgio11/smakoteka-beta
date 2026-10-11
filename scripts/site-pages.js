import {readFileSync} from 'node:fs'

const PLACES = new URL('../public/places/', import.meta.url)

function readJson(name) {
    return JSON.parse(readFileSync(new URL(name, PLACES), 'utf8'))
}

export function sitePages() {
    const {bundles} = readJson('index.json')
    const pages = ['/cities']

    for (const bundle of bundles) {
        pages.push(`/${bundle.id}`)

        for (const place of readJson(bundle.file)) {
            if (place.confirmed) pages.push(`/${bundle.id}/${place.uid}`)
        }
    }

    return pages
}

export function sitemapXml(siteUrl, pages) {
    const urls = pages.map((page) => `<url><loc>${siteUrl}${page}</loc></url>`).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`
}
