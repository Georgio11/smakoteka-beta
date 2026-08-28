import {ref} from 'vue'

const shown = ref(0)

export function useMapCount() {
    return {shown}
}
