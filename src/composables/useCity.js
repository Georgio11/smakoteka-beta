import {computed} from 'vue'
import {useRoute, useRouter} from '#imports'

export function useCity() {
    const route = useRoute()
    const router = useRouter()

    const city = computed(() => route.params.city ?? null)

    function pickCity(id) {
        router.push(`/${id}`)
    }

    return {city, pickCity}
}
