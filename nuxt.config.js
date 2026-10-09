const isAppBuild = process.env.BUILD_TARGET === 'app'

/* Сайт живе в підтеці github.io/smakoteka-beta, а застосунок віддає файли
 * з кореня, тому шлях до всього — і скриптів, і бандлів міст — залежить від збірки. */
const baseURL = isAppBuild ? '/' : '/smakoteka-beta/'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  srcDir: 'src',
  ssr: false,
  devtools: {enabled: false},
  telemetry: false,

  app: {
    baseURL,
    head: {
      htmlAttrs: {lang: 'uk'},
      title: 'СмакоТека',
      meta: [{name: 'viewport', content: 'width=device-width, initial-scale=1.0'}],
      link: [{rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg`}],
    },
  },

  spaLoadingTemplate: 'spa-loading-template.html',

  css: ['@/assets/styles/main.scss'],

  /* Nuxt збирає з відносним base './', і без цього бандли міст на сторінці
   * /smakoteka-beta/kyiv шукались би відносно неї. */
  vite: {
    define: {'import.meta.env.BASE_URL': JSON.stringify(baseURL)},
  },

  devServer: {host: '0.0.0.0'},
})
