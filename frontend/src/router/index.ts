import DashboardView from '@/views/DashboardView.vue'
import ProgramDetailView from '@/views/ProgramDetailView.vue'
import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/programs/:id', name: 'program-detail', component: ProgramDetailView, props: true },
  ],
})
