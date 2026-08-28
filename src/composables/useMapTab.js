import {ref} from 'vue'

const tab = ref('all')

export function useMapTab() {
    function resetTab() {
        tab.value = 'all'
    }

    return {tab, resetTab}
}
