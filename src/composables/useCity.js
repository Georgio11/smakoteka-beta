import {computed, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {cities} from '@/lib/placesRepo'

const cityList = ref([])

cities().then((loaded) => {
    cityList.value = loaded
})

export function useCity() {
    const route = useRoute()
    const router = useRouter()

    const city = computed(() => route.params.city ?? null)

    function pickCity(id) {
        router.push(`/${id}`)
    }

    return {cityList, city, pickCity}
}
