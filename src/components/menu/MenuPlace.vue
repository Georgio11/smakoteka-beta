<script setup>
import {computed, onUnmounted, ref} from 'vue'
import {kindLabel} from '@/components/map/kinds'
import Tooltip from '@/components/ui/Tooltip.vue'
import placeholder from '@/assets/place-placeholder.svg'
import {DAYS, DAYS_SHORT, formatSpans, formatTime, kyivNow, parseHours, statusOf} from '@/lib/hours'

const RATINGS = [
  {id: 'meh', label: 'Не моє', icon: 'fa-face-meh'},
  {id: 'ok', label: 'Норм', icon: 'fa-face-smile'},
  {id: 'top', label: 'Топ', icon: 'fa-face-smile-beam'},
]

const NETWORKS = [
  {field: 'instagram', icon: 'fa-instagram', label: 'Instagram'},
  {field: 'facebook', icon: 'fa-facebook-f', label: 'Facebook'},
  {field: 'x', icon: 'fa-x-twitter', label: 'X'},
  {field: 'telegram', icon: 'fa-telegram', label: 'Telegram'},
  {field: 'tiktok', icon: 'fa-tiktok', label: 'TikTok'},
  {field: 'youtube', icon: 'fa-youtube', label: 'YouTube'},
]

const COPIED_FOR = 2000

const COPY_TIP = 'Скопіюй посилання — воно відкриє саме цей заклад.'
const COPIED_TIP = 'Скопійовано.'
const VISITED_TIP = 'Познач місце як відвідане. Список — у профілі.'
const PLANNED_TIP = 'Відклади на потім. Список — у профілі.'

const WHEELCHAIR_TIP = {
  yes: 'Сходинок немає — так позначено на карті. Самі ми не перевіряли, тож краще подзвони.',
  limited: 'Заїхати можна, але з нюансами — сходинка, вузькі двері. Деталей ми не знаємо.',
}

const WHEELCHAIR_LABEL = {
  yes: 'Без сходинок',
  limited: 'Заїзд з нюансами',
}

const OUTDOOR_TIP = 'Влітку тут є столики надворі.'

const DIET_TIP = {
  vegan: {
    only: 'Заклад повністю веганський.',
    yes: 'Є веганські страви.',
  },
  vegetarian: {
    only: 'Заклад повністю вегетаріанський.',
    yes: 'Є вегетаріанські страви.',
  },
}

const DIET_LABEL = {vegan: 'Веганське', vegetarian: 'Вегетаріанське'}

const props = defineProps({
  place: {type: Object, required: true},
})

defineEmits(['close'])

const networks = computed(() => NETWORKS.filter((item) => props.place[item.field]))

const broken = ref(false)
const source = computed(() => (broken.value ? null : props.place.photo ?? props.place.logo ?? null))

const isLogo = computed(() => Boolean(source.value) && source.value === props.place.logo)

const levelText = computed(() => {
  const level = props.place.level

  if (!level) return null
  if (level > 0) return `${level + 1}-й поверх`

  return level === -1 ? 'цокольний поверх' : `${-level}-й підземний поверх`
})

const diet = computed(() => {
  const kind = props.place.vegan ? 'vegan' : props.place.vegetarian ? 'vegetarian' : null

  if (!kind) return null

  return {tip: DIET_TIP[kind][props.place[kind]], label: DIET_LABEL[kind]}
})

const showHours = ref(false)

const now = kyivNow()
const week = computed(() => parseHours(props.place.hours))
const status = computed(() => (week.value ? statusOf(week.value, now) : null))

const week7 = computed(() => Array.from({length: 7}, (item, shift) => {
  const day = (now.day + shift) % 7

  return {day, name: DAYS[day], time: formatSpans(week.value[day]) ?? 'Зачинено', today: shift === 0}
}))

const statusText = computed(() => {
  if (!status.value) return null
  if (status.value.isOpen) return `Відчинено · до ${formatTime(status.value.until)}`
  if (status.value.opensAt == null) return 'Зачинено'

  const when = status.value.shift === 0
      ? 'сьогодні'
      : status.value.shift === 1 ? 'завтра' : DAYS_SHORT[status.value.opensDay]

  return `Зачинено · Відчиняється: ${when}, ${formatTime(status.value.opensAt)}`
})

const mark = ref(null)
const rating = ref(null)
const copied = ref(false)

let copyTimer = null

function googleMapsUrl() {
  const query = `${props.place.lat},${props.place.lng}`

  return props.place.gid
      ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${props.place.gid}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
  } catch (err) {
    console.warn('Clipboard failed:', err.message)
    return
  }

  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, COPIED_FOR)
}

function telHref(phone) {
  return `tel:${phone.replace(/(?!^\+)\D/g, '')}`
}

function toggleMark(next) {
  mark.value = mark.value === next ? null : next

  if (mark.value !== 'visited') rating.value = null
}

onUnmounted(() => {
  clearTimeout(copyTimer)
})
</script>

<template>
  <div class="menu-place">
    <div class="menu-place__top">
      <button class="menu-place__back" @click="$emit('close')">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        Назад
      </button>
      <button class="menu-place__report">Бачиш помилку?</button>
    </div>

    <div class="menu-place__head">
      <h2 class="menu-place__name">{{ place.name }}</h2>

      <Tooltip :text="copied ? COPIED_TIP : COPY_TIP" v-slot="{ id }">
        <button
            class="btn menu-place__act"
            :aria-describedby="id"
            aria-label="Скопіювати посилання"
            @click="copyLink"
        >
          <i class="fa-regular fa-copy" aria-hidden="true"></i>
        </button>
      </Tooltip>

      <Tooltip :text="VISITED_TIP" v-slot="{ id }">
        <button
            class="btn menu-place__act"
            data-mark="visited"
            :class="{ 'btn--on': mark === 'visited' }"
            :aria-pressed="mark === 'visited'"
            :aria-describedby="id"
            aria-label="У колекції"
            @click="toggleMark('visited')"
        >
          <i class="fa-solid fa-check" aria-hidden="true"></i>
        </button>
      </Tooltip>

      <Tooltip :text="PLANNED_TIP" v-slot="{ id }">
        <button
            class="btn menu-place__act"
            data-mark="planned"
            :class="{ 'btn--on': mark === 'planned' }"
            :aria-pressed="mark === 'planned'"
            :aria-describedby="id"
            aria-label="У планах"
            @click="toggleMark('planned')"
        >
          <i
              class="fa-bookmark"
              :class="mark === 'planned' ? 'fa-solid' : 'fa-regular'"
              aria-hidden="true"
          ></i>
        </button>
      </Tooltip>
    </div>

    <div class="menu-place__frame" :class="{ 'menu-place__frame--logo': isLogo }">
      <img
          class="menu-place__photo"
          :src="source ?? placeholder"
          alt="Фото закладу"
          @error="broken = true"
      >
    </div>

    <div class="menu-place__meta">
      <span class="menu-place__flags">
        <Tooltip v-if="place.outdoor" :text="OUTDOOR_TIP">
          <i class="fa-solid fa-sun menu-place__outdoor" role="img" aria-label="Тераса"></i>
        </Tooltip>

        <Tooltip v-if="diet" :text="diet.tip">
          <i class="fa-solid fa-seedling menu-place__diet" role="img" :aria-label="diet.label"></i>
        </Tooltip>

        <Tooltip
            v-if="WHEELCHAIR_TIP[place.wheelchair]"
            :text="WHEELCHAIR_TIP[place.wheelchair]"
        >
          <i
              class="fa-solid fa-wheelchair"
              role="img"
              :aria-label="WHEELCHAIR_LABEL[place.wheelchair]"
          ></i>
        </Tooltip>
      </span>

      <span class="menu-place__kind">{{ kindLabel(place.kind) }}</span>

      <span class="menu-place__where">
        <a
            class="menu-place__addr"
            :href="googleMapsUrl()"
            target="_blank"
            rel="noopener noreferrer"
        >
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
          {{ place.address ?? 'Знайти на Google Maps' }}
        </a>
        <template v-if="levelText">, {{ levelText }}</template>
      </span>
    </div>

    <div v-if="week" class="menu-place__hours">
      <button
          class="menu-place__hours-head"
          :aria-expanded="showHours"
          @click="showHours = !showHours"
      >
        <i class="fa-regular fa-clock" aria-hidden="true"></i>
        <span class="menu-place__status" :class="{ 'menu-place__status--open': status.isOpen }">
          {{ showHours ? (status.isOpen ? 'Відчинено' : 'Зачинено') : statusText }}
        </span>
        <i class="fa-solid" :class="showHours ? 'fa-chevron-up' : 'fa-chevron-down'" aria-hidden="true"></i>
      </button>

      <dl v-if="showHours" class="menu-place__week">
        <template v-for="row in week7" :key="row.day">
          <dt :class="{ 'menu-place__day--today': row.today }">{{ row.name }}</dt>
          <dd>{{ row.time }}</dd>
        </template>
      </dl>
    </div>

    <div v-if="place.website || place.phone || networks.length" class="menu-place__links">
      <a
          v-for="item in networks"
          :key="item.field"
          class="btn menu-place__link"
          :href="place[item.field]"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="item.label"
      >
        <i class="fa-brands" :class="item.icon" aria-hidden="true"></i>
      </a>

      <a
          v-if="place.website"
          class="btn menu-place__link"
          :href="place.website"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Сайт закладу"
      >
        <i class="fa-solid fa-earth-americas" aria-hidden="true"></i>
      </a>

      <a
          v-if="place.phone"
          class="btn menu-place__link"
          :href="telHref(place.phone)"
          aria-label="Подзвонити"
      >
        <i class="fa-solid fa-phone" aria-hidden="true"></i>
      </a>
    </div>

    <div class="menu-place__tags">
      <span class="menu-place__tag" v-for="item in place.cuisine" :key="item">#{{item}}</span>
    </div>

    <div v-if="mark === 'visited'" class="menu-place__ratings" role="group" aria-label="Як тобі було">
      <button
          v-for="item in RATINGS"
          :key="item.id"
          class="btn menu-place__rating"
          :data-rate="item.id"
          :class="{ 'btn--on': rating === item.id }"
          :aria-pressed="rating === item.id"
          @click="rating = item.id"
      >
        <i class="fa-regular" :class="item.icon" aria-hidden="true"></i>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu-place {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}

.menu-place__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-3);
}

.menu-place__back {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  color: var(--ink-3);
  font-size: 13px;
  font-weight: 500;
  transition: color var(--dur) var(--ease);
}

.menu-place__report {
  color: var(--plum);
  font-size: 13px;
  font-weight: 500;
  transition: color var(--dur) var(--ease);
}

.menu-place__head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.menu-place__name {
  flex: 1;
  min-width: 0;
  font-size: 18px;
  font-weight: 600;
}

.menu-place__head .tooltip {
  flex-shrink: 0;
}

.menu-place__act {
  padding: var(--s-2);
}

.menu-place__act[data-mark='visited'] {
  --btn-accent: var(--mark-visited);
}

.menu-place__act[data-mark='planned'] {
  --btn-accent: var(--mark-planned);
}

.menu-place__links {
  display: flex;
  gap: var(--s-2);
}

.menu-place__link {
  padding: var(--s-2);
  color: var(--ink-2);
}

.menu-place__frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--r);
  overflow: hidden;
  background: var(--paper);
}

.menu-place__photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.menu-place__frame--logo .menu-place__photo {
  width: auto;
  height: 95%;
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: 50%;
  background: #fff;
}

.menu-place__meta {
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink);
}

/* Значки праворуч плаваючі, а не флексом. Флекс переносить елементи по черзі:
   не влізла адреса — за нею поїхали б і значки. З обтіканням адреса перескакує
   під них сама, а перший рядок лишається «Кафе» плюс значки. */
.menu-place__flags {
  display: flex;
  align-items: center;
  float: right;
  gap: var(--s-3);
  margin-left: var(--s-3);
  /* Плаваючий блок стає верхнім краєм урівень із верхом рядка, а не з його
     серединою. Сам собою він заввишки рівно з іконку — 14px проти 22 у рядка,
     і значок висить над текстом. `1lh` — це висота одного рядка при поточному
     line-height; з нею блок стає такий самий, як рядок тексту, і центрування
     всередині нарешті має до чого притулитись. */
  height: 1lh;
}

/* Відступ саме праворуч від типу, а не ліворуч від адреси: коли адреса
   переїжджає на другий рядок, вона має починатись від краю панелі. */
.menu-place__kind {
  margin-right: var(--s-3);
}

/* Колір тут не декор, а половина значення: сонце й паросток без нього читаються
   як абищо, а з ним — одразу як «надворі» і «рослинне». */
.menu-place__outdoor {
  color: var(--orange);
}

.menu-place__diet {
  color: var(--green);
}

/* Адреса з поверхом — одне ціле: або поруч із типом, або цілком на новому
   рядку. Розривати їх нема сенсу, поверх без адреси нічого не означає. */
.menu-place__where {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

.menu-place__addr {
  color: var(--plum);
  font-weight: 500;
}

/* Іконка вдвічі менша за текст, тому по базовій лінії вона сидить зависоко:
   гліф стоїть на ній низом, а не серединою. `middle` вирівнює її по центру
   рядка — саме там, де око чекає значок поруч зі словом. */
.menu-place__addr i {
  margin-right: var(--s-05);
  font-size: 11px;
  vertical-align: middle;
}

.menu-place__hours {
  font-size: 14px;
  color: var(--ink);
}

.menu-place__hours-head {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  color: var(--ink-2);
  font-size: 14px;
  text-align: left;
}

.menu-place__hours-head .fa-chevron-down,
.menu-place__hours-head .fa-chevron-up {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-3);
}

.menu-place__status {
  color: var(--red);
  font-weight: 500;
}

.menu-place__status--open {
  color: var(--green);
}

.menu-place__week {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s-2) var(--s-4);
  margin-top: var(--s-3);
  padding-left: var(--s-5);
  color: var(--ink-2);
}

.menu-place__day--today {
  color: var(--ink);
  font-weight: 600;
}

.menu-place__ratings {
  display: flex;
  gap: var(--s-2);
}

.menu-place__rating {
  flex: 1;
  font-size: 13px;
}

.menu-place__rating[data-rate='meh'] {
  --btn-accent: var(--rate-meh);
}

.menu-place__rating[data-rate='ok'] {
  --btn-accent: var(--rate-ok);
}

.menu-place__rating[data-rate='top'] {
  --btn-accent: var(--rate-top);
}

.menu-place__tags {
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--s-3);
  row-gap:  var(--s-2);
}

@media (hover: hover) {
  .menu-place__back:hover {
    color: var(--ink);
  }

  .menu-place__addr:hover {
    text-decoration: underline;
  }

  .menu-place__report:hover {
    text-decoration: underline;
  }
}
</style>
