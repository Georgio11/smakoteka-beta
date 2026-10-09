import {cities} from '@/lib/placesRepo'
import {readLastCity, rememberCity} from '@/lib/lastCity'

export default defineNuxtRouteMiddleware(async (to) => {
    if (!to.matched.length) return navigateTo({name: 'cities'})

    const known = await cities()
    const isKnown = (id) => known.some((city) => city.id === id)

    if (to.name === 'cities') {
        const saved = readLastCity()

        if (isKnown(saved)) return navigateTo({name: 'city', params: {city: saved}})

        return
    }

    if (to.name !== 'city') return

    if (!isKnown(to.params.city)) return navigateTo({name: 'cities'})

    rememberCity(to.params.city)
})
