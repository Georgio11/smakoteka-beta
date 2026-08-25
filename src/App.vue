<script setup>
</script>

<template>
  <div class="phone">
    <main class="content">
      <RouterView/>
    </main>

    <nav class="tabs">
      <RouterLink to="/map">карта</RouterLink>
      <RouterLink to="/list">місця</RouterLink>
      <RouterLink to="/me">я</RouterLink>
    </nav>
  </div>
</template>

<style scoped>

</style>