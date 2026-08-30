<script setup>
import {useAlert} from '@/composables/useAlert'

const {text, isError} = useAlert()
</script>

<template>
  <Transition name="alert">
    <div v-if="text" class="alert" :class="{'alert--error': isError}" role="status">{{ text }}</div>
  </Transition>
</template>

<style lang="scss" scoped>
.alert {
  position: fixed;
  top: var(--pad);
  left: 0;
  right: 0;
  z-index: var(--z-toast);
  width: fit-content;
  max-width: var(--alert-w);
  margin-inline: auto;
  padding: var(--s-2) var(--s-3);
  border-radius: var(--r-pill);
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-2);
  font-size: 13px;
  line-height: 1.4;
  color: var(--ink-2);
  text-align: center;

  &--error {
    color: var(--plum);
    background: var(--plum-bg);
    border-color: var(--plum-bg);
  }
}

.alert-enter-active,
.alert-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}

.alert-enter-from,
.alert-leave-to {
  opacity: 0;
  transform: translateY(calc(var(--s-2) * -1));
}
</style>
