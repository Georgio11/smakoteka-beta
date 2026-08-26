import { ref } from 'vue'
import { cities } from '@/lib/placesRepo'

const cityList = ref([])
const city = ref(null)

cities().then((loaded) => {
    cityList.value = loaded
})

export function useCity() {
    return { cityList, city, pickCity }
}

function pickCity(id) {
    city.value = id
}
