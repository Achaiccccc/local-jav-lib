import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/actors',
    name: 'ActorCatalog',
    component: () => import('../views/ActorCatalog.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue')
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue')
  },
  {
    path: '/actor/:id',
    name: 'ActorMovieList',
    component: () => import('../views/ActorMovieList.vue')
  },
  {
    path: '/movie/:id',
    name: 'MovieDetail',
    component: () => import('../views/MovieDetail.vue')
  },
  {
    path: '/genre/:id',
    name: 'GenreMovieList',
    component: () => import('../views/GenreMovieList.vue')
  },
  {
    path: '/series/:prefix',
    name: 'SeriesList',
    component: () => import('../views/SeriesList.vue')
  },
  {
    path: '/genres',
    name: 'GenreCatalog',
    component: () => import('../views/GenreCatalog.vue')
  },
  {
    path: '/studios',
    name: 'StudioCatalog',
    component: () => import('../views/StudioCatalog.vue')
  },
  {
    path: '/studio/:id',
    name: 'StudioMovieList',
    component: () => import('../views/StudioMovieList.vue')
  },
  {
    path: '/directors',
    name: 'DirectorCatalog',
    component: () => import('../views/DirectorCatalog.vue')
  },
  {
    path: '/director/:id',
    name: 'DirectorMovieList',
    component: () => import('../views/DirectorMovieList.vue')
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/Search.vue')
  },
  {
    path: '/search/results',
    name: 'SearchResults',
    component: () => import('../views/SearchResults.vue')
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
