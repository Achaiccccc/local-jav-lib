<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div class="toolbar-left">
          <span>每页显示：</span>
          <el-select
            :model-value="pageSize"
            style="width: 100px;"
            @change="$emit('update:pageSize', $event)"
          >
            <el-option label="10" :value="10" />
            <el-option label="20" :value="20" />
            <el-option label="30" :value="30" />
            <el-option label="50" :value="50" />
            <el-option label="100" :value="100" />
            <el-option label="500" :value="500" />
            <el-option label="1000" :value="1000" />
          </el-select>
          <span style="margin-left: 16px;">排序：</span>
          <el-select
            :model-value="sortBy"
            style="width: 180px;"
            @change="$emit('update:sortBy', $event)"
          >
            <template v-if="favoriteListMode">
              <el-option label="按记录时间倒序（最新在前）" value="addedAt-desc" />
              <el-option label="按记录时间正序" value="addedAt-asc" />
            </template>
            <el-option label="按发行时间排序-正序" value="premiered-asc" />
            <el-option label="按发行时间排序-倒序" value="premiered-desc" />
            <el-option label="按更新时间排序-正序" value="folder_updated_at-asc" />
            <el-option label="按更新时间排序-倒序" value="folder_updated_at-desc" />
            <el-option label="按标题排序-正序" value="title-asc" />
            <el-option label="按标题排序-倒序" value="title-desc" />
          </el-select>
          <!-- 预留左侧插槽（例如搜索结果统计文案等） -->
          <slot name="left-extra" />
        </div>
        <div class="toolbar-right">
          <!-- 抽奖入口：在视图模式左侧 -->
          <slot name="before-view-mode" />
          <el-radio-group
            v-if="enableViewModeToggle"
            class="view-mode-toggle"
            :model-value="viewMode"
            @change="$emit('update:viewMode', $event)"
          >
            <el-radio-button label="thumbnail">缩图模式</el-radio-button>
            <el-radio-button label="text">文字模式</el-radio-button>
            <el-radio-button label="card">图文模式</el-radio-button>
          </el-radio-group>
          <!-- 预留右侧插槽 -->
          <slot name="right-extra" />
        </div>
      </div>
    </template>

    <div v-if="loading">加载中...</div>
    <div v-else-if="movies.length === 0" class="empty-state">
      <el-empty :description="emptyText" />
    </div>
    <div v-else>
      <!-- 缩图模式：动态宽度多列，两边边距一致；悬浮时固定层放大+动画 -->
      <div
        v-if="viewMode === 'thumbnail'"
        ref="posterWaterfallRef"
        class="poster-waterfall"
        :style="posterWaterfallStyle"
      >
        <div
          v-for="(movie, index) in movies"
          :key="movie.id"
          class="poster-waterfall-item"
          :style="posterItemStyle"
          @click="onPosterClick(movie)"
          @mouseenter="e => onPosterHover(e, movie)"
          @mouseleave="onPosterLeave"
        >
          <div class="poster-waterfall-img-wrap" :style="posterWrapStyle">
            <el-image
              :src="getPosterSrc(movie, index)"
              fit="cover"
              class="poster-waterfall-img"
              :lazy="true"
              @load="onImageLoad(movie)"
            >
              <template #error>
                <div class="poster-waterfall-slot" :style="posterWrapStyle">暂无封面</div>
              </template>
            </el-image>
          </div>
        </div>
      </div>

      <!-- 文字模式 -->
      <el-table
        v-else-if="viewMode === 'text'"
        :data="movies"
        style="width: 100%"
        @row-click="row => $emit('rowClick', row)"
      >
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="code" label="识别码" width="150" />
        <el-table-column prop="premiered" label="发行日期" width="120" />
      </el-table>

      <!-- 图文模式：卡片网格 -->
      <div v-else ref="moviesGridRef" class="movies-grid">
        <el-card
          v-for="(movie, index) in movies"
          :key="movie.id"
          class="movie-card"
          shadow="hover"
          @click="$emit('rowClick', movie)"
        >
          <div class="movie-poster">
            <el-image
              :src="getPosterSrc(movie, index)"
              fit="cover"
              style="width: 100%; height: 100%;"
              :lazy="true"
              @load="onImageLoad(movie)"
            >
              <template #error>
                <div class="image-slot">暂无封面</div>
              </template>
            </el-image>
            <div v-if="movie.playable" class="play-icon" @click.stop="$emit('playVideo', movie)">
              <el-icon :size="24" color="#67c23a">
                <VideoPlay />
              </el-icon>
            </div>
            <div
              v-if="showFavoriteHeart"
              class="favorite-icon"
              :class="{ 'is-favorited': isFavorited(movie) }"
              @click.stop="$emit('toggleFavorite', movie)"
            >
              <el-icon :size="20">
                <StarFilled v-if="isFavorited(movie)" />
                <Star v-else />
              </el-icon>
            </div>
          </div>
          <div class="movie-info">
            <div class="movie-title" :title="movie.title">{{ movie.title }}</div>
            <div class="movie-meta">{{ movie.code }}</div>
          </div>
        </el-card>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="showPagination">
        <el-pagination
          v-model:current-page="internalCurrentPage"
          v-model:page-size="internalPageSize"
          :total="total"
          :page-sizes="[10, 20, 30, 50, 100, 500, 1000]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="val => $emit('update:pageSize', val)"
          @current-change="val => $emit('update:currentPage', val)"
        />
      </div>
      <!-- 缩图模式悬浮放大层：挂到 body + 进入/离开动画 -->
      <Teleport to="body">
        <Transition name="poster-overlay">
          <div
            v-if="hoveredPoster"
            class="poster-waterfall-overlay"
            :style="hoveredPoster.style"
          >
            <img
              :src="hoveredPoster.src"
              alt=""
              class="poster-waterfall-overlay-img"
            />
          </div>
        </Transition>
      </Teleport>
    </div>
  </el-card>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useElementSize } from '@vueuse/core';
import { VideoPlay, Star, StarFilled } from '@element-plus/icons-vue';
import { getImageCacheKey } from '../utils/imageLoader';

const BASE_COL_WIDTH = 150;
const ASPECT_RATIO = 0.7;
const HOVER_SCALE = 1.5;
const CARD_GRID_GAP = 16;
const CARD_MIN_WIDTH = 210;
const THUMBNAIL_BUFFER_ITEMS = 100;
const CARD_BUFFER_ITEMS = 100;
const loadedImageSetStore = new Map();
const hoveredPoster = ref(null);
const posterWaterfallRef = ref(null);
const moviesGridRef = ref(null);
const loadedImageKeySet = ref(new Set());
const { width: waterfallWidth } = useElementSize(posterWaterfallRef);
let imageLoadWindowRaf = 0;

const posterLayout = computed(() => {
  const w = waterfallWidth.value || BASE_COL_WIDTH * 4;
  const cols = Math.max(1, Math.round(w / BASE_COL_WIDTH));
  const itemWidth = w / cols;
  const itemHeight = itemWidth / ASPECT_RATIO;
  return { cols, itemWidth, itemHeight };
});

const posterWaterfallStyle = computed(() => ({
  gridTemplateColumns: `repeat(${posterLayout.value.cols}, ${posterLayout.value.itemWidth}px)`
}));

const posterItemStyle = computed(() => ({
  width: `${posterLayout.value.itemWidth}px`
}));

const posterWrapStyle = computed(() => ({
  width: `${posterLayout.value.itemWidth}px`,
  height: `${posterLayout.value.itemHeight}px`
}));

function onPosterHover(e, movie) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const { itemWidth, itemHeight } = posterLayout.value;
  const w = itemWidth * HOVER_SCALE;
  const h = itemHeight * HOVER_SCALE;
  hoveredPoster.value = {
    style: {
      left: `${rect.left + rect.width / 2 - w / 2}px`,
      top: `${rect.top + rect.height / 2 - h / 2}px`,
      width: `${w}px`,
      height: `${h}px`
    },
    src: props.imageCache?.[getImageCacheKey(movie?.poster_path, movie?.data_path_index)] || ''
  };
}

function onPosterLeave() {
  hoveredPoster.value = null;
}

//列表页图片懒加载
function getMovieLoadKey(movie, index) {
  if (movie?.id !== null && movie?.id !== undefined) return `id:${movie.id}`;
  if (movie?.code) return `code:${movie.code}`;
  return `idx:${index}`;
}

function getPosterSrc(movie, index) {
  const key = getMovieLoadKey(movie, index);
  if (!loadedImageKeySet.value.has(key)) return '';
  return props.imageCache?.[getImageCacheKey(movie?.poster_path, movie?.data_path_index)] || '';
}

function getLoadedSetStoreKey() {
  const list = props.movies || [];
  const total = list.length;
  if (!total) return `${props.viewMode}:empty`;
  const first = getMovieLoadKey(list[0], 0);
  const last = getMovieLoadKey(list[total - 1], total - 1);
  return `${props.viewMode}:${total}:${first}:${last}`;
}

function persistLoadedImageSet() {
  const key = getLoadedSetStoreKey();
  loadedImageSetStore.set(key, new Set(loadedImageKeySet.value));
}

function restoreLoadedImageSet() {
  const key = getLoadedSetStoreKey();
  const saved = loadedImageSetStore.get(key);
  if (!(saved instanceof Set) || saved.size === 0) return;
  const next = new Set(loadedImageKeySet.value);
  for (const item of saved) next.add(item);
  loadedImageKeySet.value = next;
}

function addLoadedImageWindow(startIndex, endIndex) {
  const next = new Set(loadedImageKeySet.value);
  for (let i = startIndex; i < endIndex; i++) {
    next.add(getMovieLoadKey(props.movies[i], i));
  }
  loadedImageKeySet.value = next;
  persistLoadedImageSet();
}

function getPageScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function updateImageLoadWindow() {
  const total = props.movies.length;
  if (total === 0) {
    loadedImageKeySet.value = new Set();
    return;
  }
  if (props.viewMode === 'text') return;

  const scrollTop = getPageScrollTop();
  const viewportBottom = scrollTop + window.innerHeight;
  if (props.viewMode === 'thumbnail') {
    const itemHeight = posterLayout.value.itemHeight || 0;
    const perRow = posterLayout.value.cols || 1;
    const wrapEl = posterWaterfallRef.value;
    if (!wrapEl || !itemHeight || !perRow) {
      addLoadedImageWindow(0, Math.min(total, THUMBNAIL_BUFFER_ITEMS * 2));
      return;
    }
    const rect = wrapEl.getBoundingClientRect();
    const gridTop = rect.top + scrollTop;
    const relativeTop = Math.max(0, scrollTop - gridTop);
    const firstVisibleRow = Math.floor(relativeTop / itemHeight);
    const visibleRowCount = Math.max(1, Math.ceil(window.innerHeight / itemHeight));
    const firstVisibleIndex = firstVisibleRow * perRow;
    const visibleItemCount = visibleRowCount * perRow;
    const start = Math.max(0, firstVisibleIndex - THUMBNAIL_BUFFER_ITEMS);
    const end = Math.min(total, firstVisibleIndex + visibleItemCount + THUMBNAIL_BUFFER_ITEMS);
    addLoadedImageWindow(start, end);
    return;
  }

  const wrapEl = moviesGridRef.value;
  if (!wrapEl) {
    addLoadedImageWindow(0, Math.min(total, CARD_BUFFER_ITEMS * 2));
    return;
  }
  const rect = wrapEl.getBoundingClientRect();
  const gridTop = rect.top + scrollTop;
  const width = wrapEl.clientWidth || rect.width || CARD_MIN_WIDTH;
  const perRow = Math.max(1, Math.floor((width + CARD_GRID_GAP) / (CARD_MIN_WIDTH + CARD_GRID_GAP)));
  const firstCard = wrapEl.querySelector('.movie-card');
  const rowHeight = firstCard ? firstCard.getBoundingClientRect().height : 360;
  const rowUnit = rowHeight + CARD_GRID_GAP;
  const relativeTop = Math.max(0, scrollTop - gridTop);
  const firstVisibleRow = Math.floor(relativeTop / rowUnit);
  const visibleRowCount = Math.max(1, Math.ceil((viewportBottom - scrollTop) / rowUnit) + 1);
  const firstVisibleIndex = firstVisibleRow * perRow;
  const visibleItemCount = visibleRowCount * perRow;
  const start = Math.max(0, firstVisibleIndex - CARD_BUFFER_ITEMS);
  const end = Math.min(total, firstVisibleIndex + visibleItemCount + CARD_BUFFER_ITEMS);
  addLoadedImageWindow(start, end);
}

function scheduleUpdateImageLoadWindow() {
  if (imageLoadWindowRaf) return;
  imageLoadWindowRaf = window.requestAnimationFrame(() => {
    imageLoadWindowRaf = 0;
    updateImageLoadWindow();
  });
}

function handleWindowScroll() {
  scheduleUpdateImageLoadWindow();
}

function handleWindowResize() {
  scheduleUpdateImageLoadWindow();
}

const emit = defineEmits(['rowClick', 'update:pageSize', 'update:currentPage', 'update:sortBy', 'update:viewMode', 'playVideo', 'toggleFavorite']);

function onPosterClick(movie) {
  hoveredPoster.value = null;
  emit('rowClick', movie);
}

const props = defineProps({
  loading: { type: Boolean, default: false },
  movies: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  currentPage: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  sortBy: { type: String, default: 'premiered-desc' },
  viewMode: { type: String, default: 'card' }, // 'thumbnail' | 'text' | 'card'
  imageCache: { type: Object, default: () => ({}) },
  emptyText: { type: String, default: '暂无影片数据' },
  enableViewModeToggle: { type: Boolean, default: true },
  showPagination: { type: Boolean, default: true },
  loadMovieImage: { type: Function, default: null },
  /** 是否显示收藏爱心图标（图文模式） */
  showFavoriteHeart: { type: Boolean, default: false },
  /** 按影片 code 的收藏夹 id 列表，用于判断是否已收藏：{ [code]: string[] } */
  favoriteFolderIdsByCode: { type: Object, default: () => ({}) },
  /** 列表页路由版本号：每次路由变化递增，用于清理缩图悬浮放大层 */
  routeVersion: { type: Number, default: 0 },
  /** 收藏夹影片列表：增加按收藏/最近播放记录时间的排序项 */
  favoriteListMode: { type: Boolean, default: false }
});

watch(
  () => props.routeVersion,
  () => {
    // 路由发生变化时，强制关闭悬浮放大框（包括鼠标侧键返回、前进等不触发 mouseleave 的场景）
    hoveredPoster.value = null;
  }
);

watch(
  () => [props.movies, props.viewMode, posterLayout.value.cols, posterLayout.value.itemHeight],
  async () => {
    await nextTick();
    restoreLoadedImageSet();
    scheduleUpdateImageLoadWindow();
  }
);

onMounted(async () => {
  await nextTick();
  scheduleUpdateImageLoadWindow();
  try {
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
  } catch (_) {}
  try {
    window.addEventListener('resize', handleWindowResize);
  } catch (_) {}
});

onBeforeUnmount(() => {
  try {
    window.removeEventListener('scroll', handleWindowScroll);
  } catch (_) {}
  try {
    window.removeEventListener('resize', handleWindowResize);
  } catch (_) {}
  if (imageLoadWindowRaf) {
    window.cancelAnimationFrame(imageLoadWindowRaf);
    imageLoadWindowRaf = 0;
  }
});

function isFavorited(movie) {
  if (!movie?.code) return false;
  const ids = props.favoriteFolderIdsByCode[movie.code];
  return Array.isArray(ids) && ids.length > 0;
}

const internalCurrentPage = computed({
  get: () => props.currentPage,
  set: (val) => {
    // 仅用于 v-model 绑定，真实更新通过 @update:currentPage 通知外层
  }
});

const internalPageSize = computed({
  get: () => props.pageSize,
  set: (val) => {
    // 同上
  }
});

const onImageLoad = (movie) => {
  if (typeof props.loadMovieImage === 'function') {
    props.loadMovieImage(movie);
  }
};
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
}

.empty-state {
  padding: 40px 0;
}

/* 缩图模式：动态列宽由 style 注入，无边框无间距 */
.poster-waterfall {
  display: grid;
  gap: 0;
  justify-content: start;
  width: 100%;
  padding: 0;
}

.poster-waterfall-item {
  margin: 0;
  padding: 0;
  cursor: pointer;
}

.poster-waterfall-img-wrap {
  overflow: hidden;
  position: relative;
}

.poster-waterfall-img {
  width: 100%;
  height: 100%;
  display: block;
}

.poster-waterfall-img-wrap :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.poster-waterfall-img-wrap :deep(.el-image__inner) {
  object-fit: cover;
}

/* 悬浮放大层：position:fixed + 进入/离开动画（缩放以中心为原点） */
.poster-waterfall-overlay {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  overflow: hidden;
  border-radius: 2px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  transform-origin: center;
}

.poster-waterfall-overlay-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* 悬浮层过渡：缩放 + 透明度 */
.poster-overlay-enter-active,
.poster-overlay-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.poster-overlay-enter-from,
.poster-overlay-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.poster-overlay-enter-to,
.poster-overlay-leave-from {
  opacity: 1;
  transform: scale(1);
}

.poster-waterfall-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--image-slot-bg);
  color: var(--image-slot-color);
  font-size: 12px;
}

.movies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 16px;
  padding: 16px 0;
}

.movie-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.movie-card:hover {
  transform: translateY(-4px);
}

.movie-poster {
  position: relative;
  width: 100%;
  aspect-ratio: 0.7;
  max-height: 300px;
  overflow: hidden;
  background-color: #f5f5f5;
}

.play-icon {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
}
.favorite-icon {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 30px;
  height: 30px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
  color: #fff;
}
.favorite-icon.is-favorited {
  color: #f56c6c;
}
.favorite-icon .el-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  color: #909399;
  font-size: 14px;
}

.movie-info {
  padding: 12px;
  text-align: center;
}

.movie-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
  color: var(--movie-title-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.movie-meta {
  font-size: 12px;
  color: #909399;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

/* :deep(.movies-grid .el-card__body) {
  padding: 10px 10px 0;
} */
</style>

