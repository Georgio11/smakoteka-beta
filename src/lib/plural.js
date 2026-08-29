export function plural(count, [one, few, many]) {
    const mod100 = Math.abs(count) % 100
    const mod10 = mod100 % 10

    if (mod100 > 10 && mod100 < 20) return many
    if (mod10 === 1) return one
    if (mod10 > 1 && mod10 < 5) return few

    return many
}
