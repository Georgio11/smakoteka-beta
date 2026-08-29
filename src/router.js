import {defineAsyncComponent} from 'vue'
import {createRouter, createWebHistory} from 'vue-router'
import PickCityView from './view/PickCityView.vue'
import MapLoader from './components/ui/MapLoader.vue'

const MapView = defineAsyncComponent({
    loader: () => import('./view/MapView.vue'),
    loadingComponent: MapLoader,
    delay: 0,
})
import {cities} from './lib/placesRepo'
import {readLastCity, rememberCity} from './lib/lastCity'

const routes = [
    {path: '/', name: 'entry', redirect: {name: 'cities'}},
    {path: '/cities', name: 'cities', component: PickCityView},
    {path: '/:city', name: 'city', component: MapView},
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

router.beforeEach(async (to) => {
    const known = await cities()
    const isKnown = (id) => known.some((city) => city.id === id)

    if (to.name === 'cities') {
        const saved = readLastCity()

        return isKnown(saved) ? {name: 'city', params: {city: saved}} : true
    }

    if (to.name !== 'city') return true

    if (!isKnown(to.params.city)) return {name: 'cities'}

    rememberCity(to.params.city)

    return true
})

export default router
