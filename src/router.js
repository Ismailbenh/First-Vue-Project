import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: '/signup',
    name: 'SignUp',
    component: () => import('./pages/signupPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/login',
    name: 'loginPage',
    component: () => import('./pages/loginPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'profilePage',
    component: () => import('./pages/profilePage.vue'),
    meta: { requiresAuth: true, requiresRole: 'admin' }
  },
  {
    path: '/test',
    name: 'testPage',
    component: () => import('./pages/testPage.vue'),
    meta: { requiresAuth: true, requiresRole: 'user' }
  },
  {
    path: '/groups',
    name: 'groupsPage',
    component: () => import('./pages/groupsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/rooms',
    name: 'roomsPage',
    component: () => import('./pages/roomsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/notifications',
    name: 'notificationsPage',
    component: () => import('./pages/notificationsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/info/:id?',
    name: 'infoPage',
    component: () => import('./pages/infoPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/filter',
    name: 'filterPage',
    component: () => import('./pages/filterPage.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole');

  // Check authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
    return;
  }

  // Redirect authenticated users away from login page
  if (to.name === 'loginPage' && isAuthenticated) {
    // Redirect based on role
    if (userRole === 'admin') {
      next('/');
    } else {
      next('/test');
    }
    return;
  }

  // Check role-based access
  if (to.meta.requiresRole && userRole !== to.meta.requiresRole) {
    // Redirect to appropriate page based on user role
    if (userRole === 'admin') {
      next('/');
    } else if (userRole === 'user') {
      next('/test');
    } else {
      next('/login');
    }
    return;
  }

  next();
});

export default router