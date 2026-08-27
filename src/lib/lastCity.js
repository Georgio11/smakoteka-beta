const KEY = 'smakoteka:city'

export function readLastCity() {
    try {
        return localStorage.getItem(KEY)
    } catch {
        return null
    }
}

export function rememberCity(id) {
    try {
        localStorage.setItem(KEY, id)
    } catch {

    }
}
