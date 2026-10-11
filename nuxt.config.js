import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {sitePages, sitemapXml} from './scripts/site-pages.js'

const isAppBuild = process.env.BUILD_TARGET === 'app'

/* Сайт живе в підтеці github.io/smakoteka-beta, а застосунок віддає файли
 * з кореня, тому шлях до всього — і скриптів, і бандлів міст — залежить від збірки. */
const baseURL = isAppBuild ? '/' : '/smakoteka-beta/'
const siteUrl = 'https://georgio11.github.io/smakoteka-beta'

/* Поки не вирішено, що робити з gid у бандлах, сторінки збираються, але пошуку
 * закриті. Відкрити — поставити true. */
const indexing = false

const pages = isAppBuild ? [] : sitePages()

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  srcDir: 'src',
  ssr: !isAppBuild,
  devtools: {enabled: false},
  telemetry: false,

  app: {
    baseURL,
    head: {
      htmlAttrs: {lang: 'uk'},
      title: 'СмакоТека',
      meta: [
        {name: 'viewport', content: 'width=device-width, initial-scale=1.0'},
        ...(indexing ? [] : [{name: 'robots', content: 'noindex'}]),
      ],
      link: [{rel: 'icon', type: 'image/svg+xml', href: `${baseURL}favicon.svg`}],
    },
  },

  runtimeConfig: {
    public: {siteUrl},
  },

  spaLoadingTemplate: 'spa-loading-template.html',

  css: ['@/assets/styles/main.scss'],

  features: {inlineStyles: false},

  /* Nuxt збирає з відносним base './', і без цього бандли міст на сторінці
   * /smakoteka-beta/kyiv шукались би відносно неї. */
  vite: {
    define: {'import.meta.env.BASE_URL': JSON.stringify(baseURL)},
  },

  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/', ...pages],
      /* GitHub Pages віддає kv_6b050bc1.html на /kv_6b050bc1 без редиректу,
       * а теку з index.html — тільки через 301 на адресу зі слешем. */
      autoSubfolderIndex: false,
      failOnError: true,
    },
  },

  hooks: {
    'nitro:init'(nitro) {
      if (isAppBuild) return

      nitro.hooks.hook('prerender:done', () => {
        writeFileSync(join(nitro.options.output.publicDir, 'sitemap.xml'), sitemapXml(siteUrl, pages))
      })
    },
  },

  devServer: {host: '0.0.0.0'},
})
