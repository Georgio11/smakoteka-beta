import {ref} from 'vue'

/* Алярм накриває весь застосунок, а не карту: панель непрозора й лежить вище за
 * неї, тож повідомлення, намальоване всередині карти, ховається під панеллю.
 * Тому стан живе тут, окремо від того, хто його породжує, а саме вікно висить
 * у корені застосунку. */
const text = ref('')
const isError = ref(false)

export function useAlert() {
    function show(message, {error = false} = {}) {
        text.value = message ?? ''
        isError.value = Boolean(message) && error
    }

    return {text, isError, show}
}
