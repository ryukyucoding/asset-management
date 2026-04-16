import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('@/components/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/assets' },
        {
          path: 'assets',
          name: 'assets',
          component: () => import('@/views/assets/AssetListView.vue'),
          meta: { requiresAuth: true, title: '資產目錄' },
        },
        {
          path: 'applications',
          name: 'applications',
          component: () => import('@/views/applications/ApplicationListView.vue'),
          meta: { requiresAuth: true, title: '我的申請' },
        },
        {
          path: 'admin/assets',
          name: 'admin-assets',
          component: () => import('@/views/admin/AdminAssetView.vue'),
          meta: { requiresAuth: true, requiresAdmin: true, title: '資產管理' },
        },
        {
          path: 'admin/applications',
          name: 'admin-applications',
          component: () => import('@/views/admin/AdminApplicationView.vue'),
          meta: { requiresAuth: true, requiresAdmin: true, title: '申請審核' },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) return '/login'
  if (to.meta.requiresAdmin && !auth.isAdmin) return '/assets'
})

export default router
