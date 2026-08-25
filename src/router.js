import {createRouter, createWebHistory} from "vue-router";
import ListView from "./view/ListView.vue";
import MeView from "./view/MeView.vue";
import MapView from "./view/MapView.vue";

const routes = [
    {path: '/', redirect: '/map'},
    {path: '/map', name: 'map', component: MapView},
    {path: '/list', name: 'list', component: ListView},
    {path: '/me', name: 'me', component: MeView},
]

export default createRouter({
    history: createWebHistory(),
    routes,
})