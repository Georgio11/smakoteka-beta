import {cities} from '@/lib/placesRepo'
import {rememberCity} from '@/lib/lastCity'

export default defineNuxtRouteMiddleware(async (to) => {
    if (!to.matched.length) return navigateTo({name: 'cities'})

    if (to.name !== 'city') return

    const known = await cities()

    if (!known.some((city) => city.id === to.params.city)) return navigateTo({name: 'cities'})

    if (to.query.place) {
        const {place, ...query} = to.query

        return navigateTo({name: 'city', params: {city: to.params.city, place}, query}, {replace: true})
    }

    rememberCity(to.params.city)
})
