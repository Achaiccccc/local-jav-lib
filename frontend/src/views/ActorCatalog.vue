<template>
  <div class="catalog-list">
    <el-container>
      <el-header class="page-header">
        <div class="header-content">
          <h1 class="header-title">{{ getCurrentCatalogTitle() }}</h1>
          <div class="header-right">
            <template v-if="isActorOnly">
              <el-button
                type="default"
                :icon="Refresh"
                circle
                class="grid-zoom-btn"
                title="刷新"
                @click="handleRefresh"
              />
              <el-button
                type="default"
                :icon="ZoomOut"
                circle
                class="grid-zoom-btn"
                title="缩小图片"
                @click="gridZoomOut"
              />
              <el-button
                type="default"
                :icon="ZoomIn"
                circle
                class="grid-zoom-btn"
                title="放大图片"
                @click="gridZoomIn"
              />
              <el-select
                v-model="actorSortOption"
                style="width: 220px;"
                class="catalog-selector"
              >
                <el-option label="按照名称排序 - 正序" value="name-asc" />
                <el-option label="按照名称排序 - 倒序" value="name-desc" />
                <el-option label="按照作品数量排序 - 正序" value="count-asc" />
                <el-option label="按照作品数量排序 - 倒序" value="count-desc" />
              </el-select>
            </template>
            <el-select
              v-else
              v-model="currentCatalog"
              style="width: 180px;"
              @change="handleCatalogChange"
              class="catalog-selector"
            >
              <el-option label="文件目录" value="actor-folder" />
              <el-option label="导演" value="director" />
              <el-option label="制作商" value="studio" />
              <el-option label="分类" value="genre" />
            </el-select>
            <ThemeSwitch />
          </div>
        </div>
      </el-header>
      <el-main class="page-theme-bg">
        <el-card>
          <div v-if="loading">加载中...</div>
          <div v-else-if="actors.length === 0" class="empty-state">
            <el-empty :description="getEmptyDescription()" />
          </div>
          <div
            v-else
            ref="gridRef"
            class="actors-grid"
            :class="`grid-${gridSize}`"
          >
            <div
              v-if="topPadding > 0"
              :style="{ height: topPadding + 'px' }"
            />
            <el-card
              v-for="(item, index) in visibleItems"
              :key="item.id"
              class="actor-card"
              shadow="hover"
              @click="goToDetail(item)"
            >
              <div class="actor-card-inner">
                <div class="actor-info">
                  <template v-if="showActorMode && item.avatar?.hasAvatar">
                    <div class="actor-avatar-wrap">
                      <el-image
                        :src="item.avatar.url"
                        fit="cover"
                        class="actor-avatar-image"
                      >
                        <template #error>
                          <div class="actor-avatar-slot">加载失败</div>
                        </template>
                      </el-image>
                    </div>
                  </template>
                  <div class="actor-name" :title="item.display_name && item.display_name.trim()
                        ? item.display_name.trim()
                        : (item.name || '')">
                    {{
                      item.display_name && item.display_name.trim()
                        ? item.display_name.trim()
                        : (item.name || '')
                    }}
                  </div>
                  <div class="actor-meta">
                    (<span :class="{ 'playable-count': item.playableCount > 0 }">{{ item.playableCount }}</span>/{{ item.totalCount }})
                  </div>
                </div>
                <el-icon
                  v-if="showActorMode && item.avatar?.hasMultiple"
                  class="actor-card-edit-icon"
                  @click.stop="openAvatarPicker(item.name)"
                >
                  <Edit />
                </el-icon>
              </div>
            </el-card>
            <div
              v-if="bottomPadding > 0"
              :style="{ height: bottomPadding + 'px' }"
            />
          </div>
        </el-card>
        <ActorAvatarPickerDialog
          v-model="avatarPickerVisible"
          :actor-name="avatarPickerActorName"
          @done="onAvatarPickerDone"
        />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
defineOptions({ name: 'ActorCatalog' });
import { ref, onMounted, onActivated, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Edit, ZoomIn, ZoomOut, Refresh } from '@element-plus/icons-vue';
import { useScanStore } from '../stores/scanStore';
import ThemeSwitch from '../components/ThemeSwitch.vue';
import ActorAvatarPickerDialog from '../components/ActorAvatarPickerDialog.vue';

const router = useRouter();
const route = useRoute();
const scanStore = useScanStore();
const lastRefreshedDataVersion = ref(0);
const loading = ref(true);
const actors = ref([]);
const filterPlayable = ref(false);
const avatarPickerVisible = ref(false);
const avatarPickerActorName = ref('');
const ACTOR_SORT_KEY = 'javlibrary_actor_sort_option';
const getInitialActorSort = () => {
  const allowed = ['name-asc', 'name-desc', 'count-asc', 'count-desc'];
  try {
    const stored = localStorage.getItem(ACTOR_SORT_KEY);
    return allowed.includes(stored) ? stored : 'name-asc';
  } catch (_) {
    return 'name-asc';
  }
};
const actorSortOption = ref(getInitialActorSort());
const GRID_SIZES = ['small', 'medium', 'large', 'xlarge', 'xxlarge'];
const GRID_SIZE_KEY = 'javlibrary_actor_grid_size';
const getInitialGridSize = () => {
  try {
    const stored = localStorage.getItem(GRID_SIZE_KEY);
    return GRID_SIZES.includes(stored) ? stored : 'medium';
  } catch (_) {
    return 'medium';
  }
};
const gridSize = ref(getInitialGridSize());

function gridZoomIn() {
  const i = GRID_SIZES.indexOf(gridSize.value);
  if (i < GRID_SIZES.length - 1) gridSize.value = GRID_SIZES[i + 1];
  try {
    localStorage.setItem(GRID_SIZE_KEY, gridSize.value);
  } catch (_) {}
}

function gridZoomOut() {
  const i = GRID_SIZES.indexOf(gridSize.value);
  if (i > 0) gridSize.value = GRID_SIZES[i - 1];
  try {
    localStorage.setItem(GRID_SIZE_KEY, gridSize.value);
  } catch (_) {}
}

// 演员目录独立页（仅导航栏入口）；目录页不再包含演员选项
const isActorOnly = computed(() => route.path === '/actor-catalog' || route.meta.actorOnly === true);

// 从 localStorage 恢复当前目录类型（目录页用；若曾选演员则改为文件目录）
const getInitialCatalog = () => {
  try {
    const stored = localStorage.getItem('javlibrary_catalog_type');
    if (stored === 'actor-actor') return 'actor-folder';
    return stored || 'actor-folder';
  } catch (error) {
    console.error('获取目录类型失败:', error);
    return 'actor-folder';
  }
};

const currentCatalog = ref(getInitialCatalog());

// 解析当前目录类型；演员独立页固定为 actor-actor
const catalogType = computed(() => {
  if (isActorOnly.value) return { type: 'actor', mode: 'actor' };
  const parts = currentCatalog.value.split('-');
  return {
    type: parts[0],
    mode: parts[1] || null
  };
});

// 是否按演员模式展示（头像、曾用名等）
const showActorMode = computed(() =>
  isActorOnly.value || (catalogType.value.type === 'actor' && catalogType.value.mode === 'actor')
);

// 获取当前目录标题
const getCurrentCatalogTitle = () => {
  const total = actors.value.length || 0;
  if (isActorOnly.value) {
    return total > 0 ? `演员目录（${total}）` : '演员目录';
  }
  const { type, mode } = catalogType.value;
  if (type === 'actor') {
    if (mode === 'folder') {
      return '文件目录';
    }
    return total > 0 ? `演员目录（${total}）` : '演员目录';
  } else if (type === 'director') {
    return '导演列表';
  } else if (type === 'studio') {
    return '制作商列表';
  } else if (type === 'genre') {
    return '分类列表';
  }
  return '目录';
};

const getEmptyDescription = () => {
  if (isActorOnly.value) return '暂无女优数据，请先扫描数据文件夹';
  const { type, mode } = catalogType.value;
  if (type === 'actor') {
    return mode === 'folder' ? '暂无文件目录数据，请先扫描数据文件夹' : '暂无女优数据，请先扫描数据文件夹';
  } else if (type === 'director') {
    return '暂无导演数据，请先扫描数据文件夹';
  } else if (type === 'studio') {
    return '暂无制作商数据，请先扫描数据文件夹';
  } else if (type === 'genre') {
    return '暂无分类数据，请先扫描数据文件夹';
  }
  return '暂无数据';
};

const loadCatalog = async () => {
  try {
    loading.value = true;
    const { type, mode } = catalogType.value;
    let result;

    if (type === 'actor') {
      result = await window.electronAPI.actors.getList({ viewMode: mode || 'actor' });
    } else if (type === 'director') {
      result = await window.electronAPI.directors.getList();
    } else if (type === 'studio') {
      result = await window.electronAPI.studios.getList();
    } else if (type === 'genre') {
      result = await window.electronAPI.genres.getList();
    } else {
      ElMessage.error('未知的目录类型');
      return;
    }

    if (result.success) {
      actors.value = result.data || [];
      lastRefreshedDataVersion.value = scanStore.dataVersion;
    } else {
      ElMessage.error('加载列表失败: ' + (result.message || '未知错误'));
    }
  } catch (error) {
    console.error('加载列表失败:', error);
    ElMessage.error('加载列表失败: ' + error.message);
  } finally {
    loading.value = false;
  }
};

const handleCatalogChange = () => {
  try {
    localStorage.setItem('javlibrary_catalog_type', currentCatalog.value);
  } catch (error) {
    console.error('保存目录类型失败:', error);
  }
  loadCatalog();
};

function handleRefresh() {
  loadCatalog();
}

function openAvatarPicker(name) {
  avatarPickerActorName.value = name || '';
  avatarPickerVisible.value = true;
}

async function onAvatarPickerDone() {
  const name = avatarPickerActorName.value;
  if (!name) return;
  try {
    const res = await window.electronAPI?.actorAvatars?.getSummaryByName?.(name);
    if (res?.success && res?.data) {
      const item = actors.value.find(a => a.name === name);
      if (item) item.avatar = res.data;
    }
  } catch (_) {}
}

const goToDetail = (item) => {
  const itemId = typeof item === 'object' ? item.id : item;
  if (!itemId || itemId === 'N/A' || itemId === null || itemId === undefined) {
    ElMessage.warning('无效的ID');
    return;
  }

  const { type, mode } = catalogType.value;

  if (type === 'actor') {
    if (mode === 'folder') {
      // 文件目录模式：若该文件夹下仅一部影片，直接进入详情页；否则进入列表页
      if (item.totalCount === 1 && item.movieId) {
        router.push(`/movie/${item.movieId}`);
        return;
      }
      const folderName = typeof itemId === 'string' && itemId.startsWith('folder_')
        ? itemId.replace('folder_', '')
        : itemId;
      router.push(`/actor/${encodeURIComponent(folderName)}?viewMode=folder`);
    } else {
      // 女优目录模式：id是数字
      const id = parseInt(itemId);
      if (isNaN(id)) {
        console.error('无法转换为数字的ID:', itemId);
        ElMessage.warning('无效的ID: ' + itemId);
        return;
      }
      router.push(`/actor/${id}?viewMode=actor`);
    }
  } else if (type === 'director') {
    router.push(`/director/${itemId}`);
  } else if (type === 'studio') {
    router.push(`/studio/${itemId}`);
  } else if (type === 'genre') {
    router.push(`/genre/${itemId}`);
  }
};

// 根据设置过滤项目
const filteredItems = computed(() => {
  if (!filterPlayable.value) {
    return actors.value.filter(item => item.totalCount > 0);
  }
  // 仅显示有可播放影片的项目
  return actors.value.filter(item => item.playableCount > 0);
});

watch(filteredItems, async () => {
  await nextTick();
  measureGrid();
});

watch(gridSize, async () => {
  await nextTick();
  measureGrid();
});

const sortedItems = computed(() => {
  const list = filteredItems.value.slice();
  const { type, mode } = catalogType.value;
  if (type !== 'actor' || mode !== 'actor') {
    return list;
  }
  const getDisplayName = (item) => {
    if (item.display_name && typeof item.display_name === 'string' && item.display_name.trim()) {
      return item.display_name.trim();
    }
    return (item.name || '').toString();
  };
  const collator = typeof Intl !== 'undefined'
    ? new Intl.Collator('zh-Hans', { sensitivity: 'base', numeric: true })
    : null;
  switch (actorSortOption.value) {
    case 'name-desc':
      return list.sort((a, b) => {
        const an = getDisplayName(a);
        const bn = getDisplayName(b);
        return collator ? collator.compare(bn, an) : bn.localeCompare(an);
      });
    case 'count-asc':
      return list.sort((a, b) => (a.totalCount || 0) - (b.totalCount || 0));
    case 'count-desc':
      return list.sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0));
    case 'name-asc':
    default:
      return list.sort((a, b) => {
        const an = getDisplayName(a);
        const bn = getDisplayName(b);
        return collator ? collator.compare(an, bn) : an.localeCompare(bn);
      });
  }
});

// 虚拟网格：仅渲染当前可视区域附近的演员卡片
const gridRef = ref(null);
const visibleStartIndex = ref(0);
const visibleEndIndex = ref(0);
const topPadding = ref(0);
const bottomPadding = ref(0);
const rowHeight = ref(0);
const itemsPerRow = ref(1);
const gridOffsetTop = ref(0);
const VIRTUAL_BUFFER_ROWS = 5;

const visibleItems = computed(() => {
  return sortedItems.value.slice(visibleStartIndex.value, visibleEndIndex.value);
});

function updateVirtualRange() {
  const total = sortedItems.value.length;
  if (!total) {
    visibleStartIndex.value = 0;
    visibleEndIndex.value = 0;
    topPadding.value = 0;
    bottomPadding.value = 0;
    return;
  }
  if (!rowHeight.value || !itemsPerRow.value) {
    visibleStartIndex.value = 0;
    visibleEndIndex.value = total;
    topPadding.value = 0;
    bottomPadding.value = 0;
    return;
  }

  const totalRows = Math.ceil(total / itemsPerRow.value);
  const scrollTop =
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0;
  const viewportTop = scrollTop;
  const viewportBottom = scrollTop + window.innerHeight;
  const gridTop = gridOffsetTop.value;
  const gridBottom = gridTop + totalRows * rowHeight.value;

  if (viewportBottom < gridTop || viewportTop > gridBottom) {
    visibleStartIndex.value = 0;
    visibleEndIndex.value = 0;
    topPadding.value = 0;
    bottomPadding.value = totalRows * rowHeight.value;
    return;
  }

  const relativeTop = Math.max(0, viewportTop - gridTop);
  const firstVisibleRow = Math.floor(relativeTop / rowHeight.value);
  const visibleRowCount = Math.ceil(window.innerHeight / rowHeight.value);

  const startRow = Math.max(0, firstVisibleRow - VIRTUAL_BUFFER_ROWS);
  const endRow = Math.min(totalRows - 1, firstVisibleRow + visibleRowCount + VIRTUAL_BUFFER_ROWS);

  visibleStartIndex.value = startRow * itemsPerRow.value;
  visibleEndIndex.value = Math.min(total, (endRow + 1) * itemsPerRow.value);

  topPadding.value = startRow * rowHeight.value;
  bottomPadding.value = Math.max(0, (totalRows - endRow - 1) * rowHeight.value);
}

function measureGrid() {
  const el = gridRef.value;
  const list = sortedItems.value;
  if (!el || !list.length) return;

  const rect = el.getBoundingClientRect();
  gridOffsetTop.value = rect.top + (window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0);

  const width = el.clientWidth || rect.width;
  const baseCardWidthMap = {
    small: 72,
    medium: 100,
    large: 130,
    xlarge: 160,
    xxlarge: 200
  };
  const gap = 8;
  const base = baseCardWidthMap[gridSize.value] || 100;
  const perRow = Math.max(1, Math.floor(width / (base + gap)));
  itemsPerRow.value = perRow;

  const firstCard = el.querySelector('.actor-card');
  if (firstCard) {
    const cardRect = firstCard.getBoundingClientRect();
    rowHeight.value = cardRect.height + gap;
  } else {
    rowHeight.value = 140;
  }

  updateVirtualRange();
}

// 加载过滤设置
const loadFilterPlayable = async () => {
  try {
    const value = await window.electronAPI.settings.getFilterPlayable();
    filterPlayable.value = value || false;
  } catch (error) {
    console.error('加载过滤设置失败:', error);
  }
};

onActivated(() => {
  if (isActorOnly.value) {
    // 演员页仅导航栏入口，每次进入都重新拉取，避免与目录页共用缓存实例时显示错数据
    loadCatalog();
    return;
  }
  if (scanStore.dataVersion > lastRefreshedDataVersion.value) {
    lastRefreshedDataVersion.value = scanStore.dataVersion;
    loadCatalog();
  }
});

watch(
  () => actorSortOption.value,
  (val) => {
    try {
      localStorage.setItem(ACTOR_SORT_KEY, val);
    } catch (_) {}
  }
);

function onActorProfileChanged() {
  if (isActorOnly.value) return;
  const { type } = catalogType.value;
  if (type === 'actor') {
    loadCatalog();
  }
}

function handleScroll() {
  updateVirtualRange();
}

function handleResize() {
  measureGrid();
}

onMounted(async () => {
  loadFilterPlayable();
  await loadCatalog();
  await nextTick();
  measureGrid();
  try {
    window.addEventListener('scroll', handleScroll, { passive: true });
  } catch (_) {}
  try {
    window.addEventListener('resize', handleResize);
  } catch (_) {}

  window.addEventListener('actorAvatarChanged', () => {
    if (isActorOnly.value) return;
    const { type, mode } = catalogType.value;
    if (type === 'actor' && mode === 'actor') {
      loadCatalog();
    }
  });

  if (!isActorOnly.value) {
    if (window.electronAPI?.system?.onFileChange) {
      window.electronAPI.system.onFileChange(() => {
        loadCatalog();
      });
    }
    if (window.electronAPI?.system?.onDatabaseReady) {
      window.electronAPI.system.onDatabaseReady(() => {
        loadCatalog();
      });
    }
    if (window.electronAPI?.system?.onScanCompleted) {
      window.electronAPI.system.onScanCompleted(() => {
        loadCatalog();
      });
    }
  }

  window.addEventListener('filterPlayableChanged', () => {
    loadFilterPlayable();
  });

  try {
    window.addEventListener('actorProfileChanged', onActorProfileChanged);
  } catch (_) {}
});

onBeforeUnmount(() => {
  try {
    window.removeEventListener('actorProfileChanged', onActorProfileChanged);
  } catch (_) {}
  try {
    window.removeEventListener('scroll', handleScroll);
  } catch (_) {}
  try {
    window.removeEventListener('resize', handleResize);
  } catch (_) {}
});

watch(
  () => route.fullPath,
  () => {
    avatarPickerVisible.value = false;
  }
);
</script>

<style scoped>
.catalog-list {
  width: 100%;
  height: 100%;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.header-title { margin: 0; }
.header-right { display: flex; align-items: center; gap: 12px; }
.page-header {
  background-color: var(--header-bg);
  color: var(--title-color);
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.empty-state {
  padding: 40px 0;
}

.actors-grid {
  display: grid;
  gap: 8px;
  padding: 16px 0;
}
.actors-grid.grid-small {
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
}
.actors-grid.grid-medium {
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
}
.actors-grid.grid-large {
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
}
.actors-grid.grid-xlarge {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}
.actors-grid.grid-xxlarge {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.actor-card {
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.actor-card:hover {
  transform: translateY(-4px);
}

.actor-info {
  text-align: center;
  padding: 4px;
}

.actor-avatar-wrap {
  position: relative;
  margin: 0 auto 6px;
  width: 80px;
  height: 80px;
}
.actors-grid.grid-small .actor-avatar-wrap {
  width: 56px;
  height: 56px;
  margin-bottom: 4px;
}
.actors-grid.grid-large .actor-avatar-wrap {
  width: 104px;
  height: 104px;
  margin-bottom: 8px;
}
.actors-grid.grid-xlarge .actor-avatar-wrap {
  width: 128px;
  height: 128px;
  margin-bottom: 10px;
}
.actors-grid.grid-xxlarge .actor-avatar-wrap {
  width: 160px;
  height: 160px;
  margin-bottom: 12px;
}

.actor-avatar-image {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  display: block;
  background: var(--el-fill-color-light);
}
.actors-grid.grid-small .actor-avatar-image {
  width: 56px;
  height: 56px;
  border-radius: 6px;
}
.actors-grid.grid-large .actor-avatar-image {
  width: 104px;
  height: 104px;
  border-radius: 10px;
}
.actors-grid.grid-xlarge .actor-avatar-image {
  width: 128px;
  height: 128px;
  border-radius: 12px;
}
.actors-grid.grid-xxlarge .actor-avatar-image {
  width: 160px;
  height: 160px;
  border-radius: 14px;
}

.actor-avatar-slot {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
}
.actors-grid.grid-small .actor-avatar-slot {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  font-size: 10px;
}
.actors-grid.grid-large .actor-avatar-slot {
  width: 104px;
  height: 104px;
  border-radius: 10px;
  font-size: 12px;
}
.actors-grid.grid-xlarge .actor-avatar-slot {
  width: 128px;
  height: 128px;
  border-radius: 12px;
  font-size: 13px;
}
.actors-grid.grid-xxlarge .actor-avatar-slot {
  width: 160px;
  height: 160px;
  border-radius: 14px;
  font-size: 14px;
}

.actor-card-edit-icon {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  padding: 2px;
  border-radius: 4px;
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

:deep(.actor-card .el-card__body) {
  padding: 5px 0;
}

.actor-name {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 2px;
  color: var(--content-title-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.actors-grid.grid-small .actor-name { font-size: 11px; }
.actors-grid.grid-large .actor-name { font-size: 13px; }
.actors-grid.grid-xlarge .actor-name { font-size: 14px; }
.actors-grid.grid-xxlarge .actor-name { font-size: 15px; }

.actor-meta {
  font-size: 10px;
  color: var(--content-subtitle-color);
}
.actors-grid.grid-small .actor-meta { font-size: 9px; }
.actors-grid.grid-large .actor-meta { font-size: 11px; }
.actors-grid.grid-xlarge .actor-meta { font-size: 12px; }
.actors-grid.grid-xxlarge .actor-meta { font-size: 13px; }

.playable-count {
  color: #67c23a;
  font-weight: bold;
}

/* 当可播放条数为0时，不应用绿色样式 */
.actor-meta span:not(.playable-count) {
  color: inherit;
  font-weight: normal;
}

/* 日间头部：放大/缩小按钮与下拉框统一白字、半透明 */
[data-theme="light"] .grid-zoom-btn {
  color: white;
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}
[data-theme="light"] .grid-zoom-btn:hover {
  background-color: rgba(255, 255, 255, 0.35);
  border-color: rgba(255, 255, 255, 0.5);
  color: white;
}
[data-theme="light"] :deep(.catalog-selector) {
  color: white;
}
[data-theme="light"] :deep(.catalog-selector .el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3) inset;
}
[data-theme="light"] :deep(.catalog-selector .el-input__inner),
[data-theme="light"] :deep(.catalog-selector .el-input__wrapper) {
  color: white;
}
[data-theme="light"] :deep(.catalog-selector .el-select__caret) {
  color: white;
}
</style>
