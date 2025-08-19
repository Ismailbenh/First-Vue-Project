import { createRouter, createWebHistory } from "vue-router";

import profilePage from "./pages/profilePage.vue";
import infoPage from "./pages/infoPage.vue";

const routes=[
    {   path:'/', 
        name:'profilePage', 
        component:profilePage,
    },
    { 
        path:'/infoPage/:id?', 
        name:'infoPage', 
        component: infoPage,
        props: true,
    },
]

const router = createRouter({
    history:createWebHistory(),
    routes,
})
export default router