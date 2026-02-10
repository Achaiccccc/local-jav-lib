<template>
  <div class="home">
    <el-container>
      <el-header>
        <h1 style="margin: 0;">JavLibrary - 本地影视库</h1>
      </el-header>
      <el-main ref="mainContentRef">
        <MovieListLayout
          :loading="loading"
          :movies="movies"
          :total="total"
          :current-page="currentPage"
          :page-size="pageSize"
          :sort-by="sortBy"
          :view-mode="viewMode"
          :image-cache="imageCache"
          :enable-view-mode-toggle="true"
          @update:pageSize="handlePageSizeChange"
          @update:currentPage="handlePageChange"
          @update:sortBy="val => (sortBy = val)"
          @update:viewMode="val => { viewMode = val; handleViewModeChange(); }"
          @rowClick="goToMovieDetail"
          :load-movie-image="movie => loadMovieImage(movie.poster_path, movie.data_path_index)"
        />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { VideoPlay } from '@element-plus/icons-vue';
import MovieListLayout from '../components/MovieListLayout.vue';
import { savePageState, getPageState, saveScrollPosition, restoreScrollPosition, clearScrollPosition } from '../utils/pageState';
import { loadImagesBatch, pauseBackgroundLoading, resumeBackgroundLoading } from '../utils/imageLoader';
import { withLoadingOptimization } from '../utils/loadingOptimizer';

const router = useRouter();
const route = useRoute();
const loading = ref(true);
const movies = ref([]);
const total = ref(0);
const pageKey = 'home';

// 从缓存恢复状态
const savedState = getPageState(pageKey, {
  currentPage: 1,
  pageSize: 20,
  sortBy: 'premiered-desc'
});

const currentPage = ref(savedState.currentPage);
const pageSize = ref(savedState.pageSize);
const sortBy = ref(savedState.sortBy);
const viewMode = ref('thumbnail');
const imageCache = ref({}); // 图片缓存
const mainContentRef = ref(null); // 主内容区域引用

// 使用加载优化包装器
const loadMoviesRaw = async () => {
    loading.value = true;
    const result = await window.electronAPI.movies.getList({
      page: currentPage.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value
    });
    if (result.success) {
      movies.value = result.data || [];
      total.value = result.total || 0;
    // 使用全局图片加载管理器分批加载图片
    loadImagesBatch(movies.value, imageCache.value, 20);
    } else {
      ElMessage.error('加载影片列表失败: ' + (result.message || '未知错误'));
    }
    loading.value = false;
  return result;
};

// 包装后的加载函数，自动处理暂停/恢复
const loadMovies = withLoadingOptimization(loadMoviesRaw);

const loadMovieImage = async (posterPath, dataPathIndex = 0) => {
  // 使用全局加载管理器（非优先级）
  const { loadImage } = await import('../utils/imageLoader');
  return await loadImage(posterPath, dataPathIndex, false, imageCache.value);
};

const handlePageChange = (page) => {
  currentPage.value = page;
  // 保存状态
  savePageState(pageKey, {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    sortBy: sortBy.value
  });
  // 翻页时清除滚动位置缓存，并滚动到顶部
  clearScrollPosition(pageKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadMovies();
};

const handlePageSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
  // 保存状态
  savePageState(pageKey, {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    sortBy: sortBy.value
  });
  // 改变每页数量时清除滚动位置缓存，并滚动到顶部
  clearScrollPosition(pageKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadMovies();
};

const handleViewModeChange = () => {
  // 视图模式切换不需要重新加载数据
};

// 监听排序变化
watch(sortBy, (newValue) => {
  // 保存状态
  savePageState(pageKey, {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    sortBy: newValue
  });
  // 排序变化时重置到第一页
  currentPage.value = 1;
  // 改变排序时清除滚动位置缓存，并滚动到顶部
  clearScrollPosition(pageKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadMovies();
});

const goToMovieDetail = (movieId) => {
  if (typeof movieId === 'object') {
    movieId = movieId.id;
  }
  // 暂停后台图片加载，优先处理用户请求
  pauseBackgroundLoading();
  
  // 保存当前状态
  savePageState(pageKey, {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    sortBy: sortBy.value
  });
  // 保存滚动位置
  saveScrollPosition(pageKey);
  router.push({
    path: `/movie/${movieId}`,
    query: {
      from: 'home',
      page: currentPage.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value
    }
  });
};

onMounted(() => {
  // 恢复后台图片加载（从详情页返回时）
  resumeBackgroundLoading();
  
  // 从路由query参数恢复状态（优先使用query参数，其次使用缓存）
  const query = route.query;
  let restored = false;
  
  if (query.page) {
    currentPage.value = parseInt(query.page) || 1;
    restored = true;
  }
  if (query.pageSize) {
    pageSize.value = parseInt(query.pageSize) || 20;
    restored = true;
  }
  if (query.sortBy) {
    sortBy.value = query.sortBy;
    restored = true;
  }
  
  // 如果从query参数恢复了状态，更新缓存
  if (restored) {
    savePageState(pageKey, {
      currentPage: currentPage.value,
      pageSize: pageSize.value,
      sortBy: sortBy.value
    });
  }
  
  // 先设置数据库就绪事件监听，再尝试加载数据
  let databaseReady = false;
  let loadMoviesCalled = false;
  
  const tryLoadMovies = async () => {
    if (loadMoviesCalled) return;
    
    // 先检查数据库是否就绪
    try {
      if (window.electronAPI?.system?.isDatabaseReady) {
        const result = await window.electronAPI.system.isDatabaseReady();
        if (result.ready) {
          loadMoviesCalled = true;
          loadMovies();
          return;
        }
      }
    } catch (error) {
      console.error('检查数据库就绪状态失败:', error);
    }
    
    // 如果检查失败或数据库未就绪，延迟重试
    if (!loadMoviesCalled) {
      setTimeout(() => {
        if (!loadMoviesCalled) {
          console.log('延迟后尝试加载数据');
          loadMoviesCalled = true;
          loadMovies();
        }
      }, 1500); // 延迟1.5秒，给数据库初始化时间
    }
  };
  
  // 监听数据库就绪事件（优先处理）
  if (window.electronAPI?.system?.onDatabaseReady) {
    window.electronAPI.system.onDatabaseReady(() => {
      console.log('收到数据库就绪事件，加载数据');
      databaseReady = true;
      if (!loadMoviesCalled) {
        loadMoviesCalled = true;
        loadMovies();
      }
    });
  }
  
  // 尝试加载数据（会先检查数据库是否就绪）
  tryLoadMovies();
  
  // 恢复滚动位置（延迟执行，确保 DOM 已渲染）
  restoreScrollPosition(pageKey, 200);
  
  // 监听文件变化事件
  if (window.electronAPI?.system?.onFileChange) {
    window.electronAPI.system.onFileChange((data) => {
      console.log('文件变化:', data);
      loadMovies();
    });
  }
  
  // 监听扫描完成事件
  if (window.electronAPI?.system?.onScanCompleted) {
    window.electronAPI.system.onScanCompleted((result) => {
      console.log('扫描完成:', result);
      loadMovies();
    });
  }
  
  // 监听过滤设置变化事件
  window.addEventListener('filterPlayableChanged', () => {
    console.log('过滤设置已更改，重新加载影片列表');
    loadMovies();
  });
});

onBeforeUnmount(() => {
  // 组件卸载前保存状态
  savePageState(pageKey, {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    sortBy: sortBy.value
  });
  // 保存滚动位置
  saveScrollPosition(pageKey);
});
</script>

<style scoped>
.home {
  width: 100%;
  height: 100%;
}

.el-header {
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

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
  color: #303133;
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
</style>
