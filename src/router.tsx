import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { AppShell, ChatPage, ComparePage, LandingPage, SettingsPage } from './views'
import { api } from './api'

const rootRoute = createRootRoute({ component: AppShell })
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage })
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: Outlet,
})
const appIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: async () => {
    let threads = await api.threads().catch(() => [])
    if (!threads.length) threads = [await api.createThread()]
    throw redirect({ to: '/app/$threadId', params: { threadId: threads[0].id } })
  },
})
const chatRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$threadId',
  component: ChatPage,
})
const compareRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '$threadId/compare',
  component: ComparePage,
})
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})
const routeTree = rootRoute.addChildren([landingRoute, settingsRoute, appRoute.addChildren([appIndexRoute, chatRoute, compareRoute])])
export const router = createRouter({ routeTree })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }