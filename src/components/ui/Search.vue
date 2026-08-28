<template>
  <label class="search">
    <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
    <input
        class="search__input"
        type="search"
        placeholder="Що шукаємо?"
        aria-label="Пошук місць"
    >
  </label>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3);
  border: 1px solid var(--line);
  border-radius: var(--r);
  color: var(--ink-3);
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}

.search:focus-within {
  border-color: var(--line-2);
  box-shadow: var(--shadow-1);
}

.search__input {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  color: var(--ink);
}

.search__input::placeholder {
  color: var(--ink-3);
}

.search__input:focus-visible {
  outline: none;
}

.search__input::-webkit-search-cancel-button {
  display: none;
}
</style>
