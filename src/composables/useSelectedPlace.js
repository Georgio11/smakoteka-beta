import {computed} from 'vue'
import {useRoute, useRouter} from 'vue-router'

export function useSelectedPlace() {
    const route = useRoute()
    const router = useRouter()

    const uid = computed(() => route.query.place ?? null)

    function selectPlace(next) {
        if (next === uid.value) return

        router.push({query: {...route.query, place: next}})
    }

    function closePlace() {
        if (!uid.value) return

        const query = {...route.query}

        delete query.place

        router.push({query})
    }

    return {uid, selectPlace, closePlace}
}
