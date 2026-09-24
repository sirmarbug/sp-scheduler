import { createRouter, createWebHistory } from 'vue-router'
import { redirectIfAuthenticated, requireAuth } from './guards'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: { name: 'employees' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      beforeEnter: redirectIfAuthenticated,
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/auth/RegisterView.vue'),
      beforeEnter: redirectIfAuthenticated,
    },
    {
      path: '/employees',
      name: 'employees',
      component: () => import('../views/employees/EmployeesView.vue'),
      beforeEnter: requireAuth,
    },
    {
      path: '/month-config',
      name: 'month-config',
      component: () => import('../views/month-config/MonthConfigView.vue'),
      beforeEnter: requireAuth,
    },
    {
      path: '/requests',
      name: 'requests',
      component: () => import('../views/requests/RequestsView.vue'),
      beforeEnter: requireAuth,
    },
    {
      path: '/schedule',
      name: 'schedule',
      component: () => import('../views/schedule/ScheduleView.vue'),
      beforeEnter: requireAuth,
    },
    {
      path: '/:catchAll(.*)',
      name: 'not-found',
      component: () => import('../views/error/NotFoundView.vue'),
    },
  ],
})
