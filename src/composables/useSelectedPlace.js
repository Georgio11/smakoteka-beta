import {computed} from 'vue'
import {useRoute, useRouter} from '#imports'

export function useSelectedPlace() {
    const route = useRoute()
    const router = useRouter()

    const uid = computed(() => route.params.place || null)

    function selectPlace(next) {
        if (next === uid.value) return

        router.push({name: 'city', params: {city: route.params.city, place: next}, query: route.query})
    }

    function closePlace() {
        if (!uid.value) return

        router.push({name: 'city', params: {city: route.params.city}, query: route.query})
    }

    return {uid, selectPlace, closePlace}
}
