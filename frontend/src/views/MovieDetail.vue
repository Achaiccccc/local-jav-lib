<template>
  <div class="movie-detail">
    <el-container>
      <el-header>
        <div class="header-content">
          <el-button @click="goBack" icon="ArrowLeft">返回</el-button>
          <h1 style="margin: 0; margin-left: 16px;">影片详情</h1>
        </div>
      </el-header>
      <el-main>
        <el-card v-if="loading">加载中...</el-card>
        <el-card v-else-if="!movie" class="empty-state">
          <el-empty description="影片不存在" />
        </el-card>
        <div v-else class="movie-content">
          <div class="movie-left">
            <div class="image-wrapper">
              <el-image
                :src="getPosterUrl()"
                fit="cover"
                class="poster-image"
                :preview-src-list="[getPosterUrl()]"
                :lazy="true"
                :preview-teleported="true"
                :hide-on-click-modal="true"
              >
                <template #error>
                  <div class="image-slot">暂无封面</div>
                </template>
              </el-image>
            </div>
          </div>
          <div class="movie-right">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="标题">
                {{ movie.title }}
              </el-descriptions-item>
              <el-descriptions-item label="识别码">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <el-link type="primary" @click="goToSeries(movie.code)">
                    {{ movie.code }}
                  </el-link>
                  <el-icon 
                    class="copy-icon" 
                    @click="copyCode(movie.code)"
                    style="cursor: pointer; color: #409eff;"
                    :size="16"
                  >
                    <DocumentCopy />
                  </el-icon>
                </div>
              </el-descriptions-item>
              <el-descriptions-item label="发行日期">
                {{ movie.premiered || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="片长">
                {{ movie.runtime ? movie.runtime + ' 分钟' : '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="演员">
                <div v-if="movie.actors && movie.actors.length > 0" class="link-list">
                  <el-link
                    v-for="(actor, index) in movie.actors"
                    :key="actor.id || `actor-${index}`"
                    :type="actor.inDatabase ? 'primary' : 'info'"
                    :disabled="!actor.inDatabase"
                    :style="{ 
                      marginRight: '8px',
                      color: actor.inDatabase ? '' : '#909399',
                      cursor: actor.inDatabase ? 'pointer' : 'not-allowed'
                    }"
                    @click="actor.inDatabase && goToActor(actor.id)"
                  >
                    {{ actor.name }}
                  </el-link>
                </div>
                <span v-else>未知</span>
              </el-descriptions-item>
              <el-descriptions-item label="导演">
                <el-link v-if="movie.director && movie.director.id" type="primary" @click="goToDirector(movie.director.id)">
                  {{ movie.director.name || movie.director }}
                </el-link>
                <span v-else style="color: #909399;">未知</span>
              </el-descriptions-item>
              <el-descriptions-item label="制作商">
                <el-link v-if="movie.studio && movie.studio.id" type="primary" @click="goToStudio(movie.studio.id)">
                  {{ movie.studio.name }}
                </el-link>
                <span v-else style="color: #909399;">未知</span>
              </el-descriptions-item>
              <el-descriptions-item label="类别">
                <div v-if="movie.genres && movie.genres.length > 0" class="link-list">
                  <el-link
                    v-for="genre in movie.genres"
                    :key="genre.id"
                    type="primary"
                    style="margin-right: 8px;"
                    @click="goToGenre(genre.id)"
                  >
                    {{ genre.name }}
                  </el-link>
                </div>
                <span v-else>未知</span>
              </el-descriptions-item>
            </el-descriptions>
            <div style="margin-top: 20px;">
              <el-button v-if="movie.playable" type="success" @click="playVideo" icon="VideoPlay">
                播放
              </el-button>
              <el-button type="primary" @click="editMovie">编辑</el-button>
              <el-button 
                @click="openFileLocation" 
                icon="FolderOpened"
                class="open-location-btn"
              >
                打开文件所在位置
              </el-button>
            </div>
          </div>
        </div>
        
        <!-- 编辑对话框 -->
        <el-dialog
          v-model="editDialogVisible"
          title="编辑影片信息"
          width="600px"
          :close-on-click-modal="false"
        >
          <el-form
            ref="editFormRef"
            :model="editForm"
            :rules="editFormRules"
            label-width="100px"
          >
            <el-form-item label="标题" prop="title">
              <el-input
                v-model="editForm.title"
                type="textarea"
                :rows="3"
                placeholder="请输入标题"
              />
            </el-form-item>
            <el-form-item label="识别码" prop="code">
              <el-input v-model="editForm.code" disabled />
            </el-form-item>
            <el-form-item label="发行日期" prop="premiered">
              <el-date-picker
                v-model="editForm.premiered"
                type="date"
                placeholder="选择发行日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%;"
              />
            </el-form-item>
            <el-form-item label="片长（分钟）" prop="runtime">
              <el-input-number
                v-model="editForm.runtime"
                :min="0"
                :max="9999"
                placeholder="请输入片长"
                style="width: 100%;"
              />
            </el-form-item>
            <el-form-item label="导演" prop="director">
              <el-select
                v-model="editForm.director"
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入导演名称"
                style="width: 100%;"
                clearable
              >
                <el-option
                  v-for="director in availableDirectors"
                  :key="director"
                  :label="director"
                  :value="director"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="制作商" prop="studio">
              <el-select
                v-model="editForm.studio"
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入制作商名称"
                style="width: 100%;"
                clearable
              >
                <el-option
                  v-for="studio in availableStudios"
                  :key="studio"
                  :label="studio"
                  :value="studio"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="演员" prop="actors">
              <el-select
                v-model="editForm.actors"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入演员名称"
                style="width: 100%;"
                @change="handleActorsChange"
              >
                <el-option
                  v-for="actor in availableActors"
                  :key="actor"
                  :label="actor"
                  :value="actor"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="分类" prop="genres">
              <el-select
                v-model="editForm.genres"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入分类名称"
                style="width: 100%;"
                @change="handleGenresChange"
              >
                <el-option
                  v-for="genre in availableGenres"
                  :key="genre"
                  :label="genre"
                  :value="genre"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <span class="dialog-footer">
              <el-button @click="editDialogVisible = false">取消</el-button>
              <el-button type="primary" @click="saveMovie" :loading="saving">
                保存
              </el-button>
            </span>
          </template>
        </el-dialog>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeMount, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { VideoPlay, FolderOpened, DocumentCopy } from '@element-plus/icons-vue';
import { loadImage as loadImageWithPriority, resumeBackgroundLoading } from '../utils/imageLoader';

const router = useRouter();
const route = useRoute();
const movieId = computed(() => {
  const id = parseInt(route.params.id);
  if (isNaN(id)) {
    console.error('无效的影片ID:', route.params.id);
    return null;
  }
  return id;
});

const loading = ref(true);
const movie = ref(null);
const posterUrl = ref('');
const editDialogVisible = ref(false);
const editFormRef = ref(null);
const saving = ref(false);
const availableActors = ref([]);
const availableGenres = ref([]);
const availableDirectors = ref([]);
const availableStudios = ref([]);
const editForm = ref({
  title: '',
  code: '',
  premiered: '',
  runtime: null,
  director: '',
  studio: '',
  actors: [],
  genres: []
});

const editFormRules = {
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' }
  ]
};

const loadMovie = async () => {
  try {
    loading.value = true;
    posterUrl.value = ''; // 重置图片URL
    if (!movieId.value) {
      ElMessage.error('无效的影片ID');
      return;
    }
    const result = await window.electronAPI.movies.getById(movieId.value);
    if (result && result.success) {
      movie.value = result.data;
      // 使用优先级加载图片（用户请求，优先处理）
      const imagePath = result.data.fanart_path || result.data.poster_path;
      if (imagePath) {
        try {
          const dataPathIndex = result.data.data_path_index || 0;
          // 使用优先级加载，确保立即处理
          const imageUrl = await loadImageWithPriority(imagePath, dataPathIndex, true, {});
          posterUrl.value = imageUrl || '';
        } catch (error) {
          console.error('加载图片失败:', error);
          posterUrl.value = '';
        }
      }
    } else {
      ElMessage.error('加载影片详情失败: ' + (result?.message || '未知错误'));
    }
  } catch (error) {
    console.error('加载影片详情失败:', error);
    ElMessage.error('加载影片详情失败: ' + error.message);
  } finally {
    loading.value = false;
    // 加载完成后，恢复后台图片加载
    resumeBackgroundLoading();
  }
};

const getPosterUrl = () => {
  return posterUrl.value || '';
};

const goToSeries = (code) => {
  // 提取系列前缀（如CAWD-001 -> CAWD）
  const seriesPrefix = code.split('-')[0];
  router.push(`/series/${seriesPrefix}`);
};

const goToActor = (actorId) => {
  // 保存当前详情页信息，以便返回
  // 从详情页点击的演员应该使用女优目录模式（actor模式），因为所有演员数据都来自NFO
  router.push({
    path: `/actor/${actorId}`,
    query: {
      from: 'movie',
      movieId: movieId.value,
      viewMode: 'actor' // 明确指定使用女优目录模式
    }
  });
};

const goToGenre = (genreId) => {
  // 保存当前详情页信息，以便返回
  router.push({
    path: `/genre/${genreId}`,
    query: {
      from: 'movie',
      movieId: movieId.value
    }
  });
};

const goToStudio = (studioId) => {
  router.push({
    path: `/studio/${studioId}`,
    query: {
      from: 'movie',
      movieId: movieId.value
    }
  });
};

const goToDirector = (directorId) => {
  router.push({
    path: `/director/${directorId}`,
    query: {
      from: 'movie',
      movieId: movieId.value
    }
  });
};

const loadActorsAndGenres = async () => {
  try {
    // 加载演员列表
    const actorsResult = await window.electronAPI.actors.getList({ viewMode: 'actor' });
    if (actorsResult.success && actorsResult.data) {
      availableActors.value = actorsResult.data.map(actor => actor.name).filter(Boolean);
    }
    
    // 加载分类列表
    const genresResult = await window.electronAPI.genres.getList();
    if (genresResult.success && genresResult.data) {
      availableGenres.value = genresResult.data.map(genre => genre.name).filter(Boolean);
    }
    
    // 加载导演列表
    const directorsResult = await window.electronAPI.directors.getList();
    if (directorsResult.success && directorsResult.data) {
      availableDirectors.value = directorsResult.data.map(director => director.name).filter(Boolean);
    }
    
    // 加载制作商列表
    const studiosResult = await window.electronAPI.studios.getList();
    if (studiosResult.success && studiosResult.data) {
      availableStudios.value = studiosResult.data.map(studio => studio.name).filter(Boolean);
    }
  } catch (error) {
    console.error('加载演员和分类列表失败:', error);
  }
};

const editMovie = async () => {
  if (!movie.value) {
    ElMessage.error('影片信息不完整');
    return;
  }
  
  // 加载演员和分类列表
  await loadActorsAndGenres();
  
  // 初始化编辑表单，确保所有值都是基本类型
  editForm.value = {
    title: String(movie.value.title || ''),
    code: String(movie.value.code || ''),
    premiered: movie.value.premiered ? String(movie.value.premiered) : '',
    runtime: movie.value.runtime !== null && movie.value.runtime !== undefined ? Number(movie.value.runtime) : null,
    director: movie.value.director ? String(movie.value.director.name || movie.value.director) : '',
    studio: movie.value.studio ? String(movie.value.studio.name) : '',
    actors: movie.value.actors && Array.isArray(movie.value.actors) 
      ? movie.value.actors.map(a => String(a.name || a)).filter(Boolean)
      : [],
    genres: movie.value.genres && Array.isArray(movie.value.genres)
      ? movie.value.genres.map(g => String(g.name || g)).filter(Boolean)
      : []
  };
  
  editDialogVisible.value = true;
};

// 确保演员数组中的值都是字符串
const handleActorsChange = (value) => {
  editForm.value.actors = Array.isArray(value) 
    ? value.map(a => String(a)).filter(Boolean)
    : [];
};

// 确保分类数组中的值都是字符串
const handleGenresChange = (value) => {
  editForm.value.genres = Array.isArray(value)
    ? value.map(g => String(g)).filter(Boolean)
    : [];
};

const saveMovie = async () => {
  if (!editFormRef.value) {
    return;
  }
  
  try {
    await editFormRef.value.validate();
    saving.value = true;
    
    // 确保所有数据都是可序列化的基本类型
    const updateData = {
      title: String(editForm.value.title || ''),
      premiered: editForm.value.premiered ? String(editForm.value.premiered) : null,
      runtime: editForm.value.runtime !== null && editForm.value.runtime !== undefined 
        ? Number(editForm.value.runtime) 
        : null,
      director: editForm.value.director ? String(editForm.value.director) : null,
      studio: editForm.value.studio ? String(editForm.value.studio) : null,
      actors: Array.isArray(editForm.value.actors) 
        ? editForm.value.actors.map(a => String(a)).filter(Boolean)
        : [],
      genres: Array.isArray(editForm.value.genres)
        ? editForm.value.genres.map(g => String(g)).filter(Boolean)
        : []
    };
    
    const result = await window.electronAPI.movies.update(movie.value.id, updateData);
    
    if (result.success) {
      ElMessage.success('影片信息已更新');
      editDialogVisible.value = false;
      // 直接使用返回的数据更新 movie.value，避免重新查询
      if (result.data) {
        movie.value = result.data;
        // 使用优先级加载图片（用户操作触发的更新）
        const imagePath = result.data.fanart_path || result.data.poster_path;
        if (imagePath) {
          try {
            const dataPathIndex = result.data.data_path_index || 0;
            const imageUrl = await loadImageWithPriority(imagePath, dataPathIndex, true, {});
            posterUrl.value = imageUrl || '';
          } catch (error) {
            console.error('加载图片失败:', error);
            posterUrl.value = '';
          }
        }
      } else {
        // 如果返回数据为空，则重新加载
        await loadMovie();
      }
    } else {
      ElMessage.error('更新失败: ' + (result.message || '未知错误'));
    }
  } catch (error) {
    if (error !== false) { // 表单验证失败时 error 为 false
      console.error('保存影片信息失败:', error);
      ElMessage.error('保存失败: ' + (error.message || '未知错误'));
    }
  } finally {
    saving.value = false;
  }
};

const playVideo = async () => {
  if (!movie.value || !movie.value.id) {
    ElMessage.error('影片信息不完整');
    return;
  }
  
  try {
    // 暂停后台加载，优先处理播放请求
    const { pauseBackgroundLoading, resumeBackgroundLoading } = await import('../utils/imageLoader');
    pauseBackgroundLoading();
    
    ElMessage.info('正在打开播放器...');
    const result = await window.electronAPI.movie.playVideo(movie.value.id);
    if (result.success) {
      ElMessage.success('已使用系统默认播放器打开视频');
    } else {
      ElMessage.error(result.message || '播放失败');
    }
    
    // 播放请求完成后，恢复后台加载
    resumeBackgroundLoading();
  } catch (error) {
    console.error('播放视频失败:', error);
    ElMessage.error('播放失败: ' + error.message);
    // 即使失败也恢复后台加载
    const { resumeBackgroundLoading } = await import('../utils/imageLoader');
    resumeBackgroundLoading();
  }
};

const openFileLocation = async () => {
  if (!movie.value || !movie.value.id) {
    ElMessage.error('影片信息不完整');
    return;
  }
  
  try {
    const result = await window.electronAPI.movies.openFileLocation(movie.value.id);
    if (result.success) {
      ElMessage.success('已打开文件所在位置');
    } else {
      ElMessage.error('打开失败: ' + (result.message || '未知错误'));
    }
  } catch (error) {
    console.error('打开文件所在位置失败:', error);
    ElMessage.error('打开失败: ' + error.message);
  }
};

const copyCode = async (code) => {
  if (!code) {
    ElMessage.warning('识别码为空');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(code);
    ElMessage.success('识别码已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    // 降级方案：使用传统方法
    try {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      ElMessage.success('识别码已复制到剪贴板');
    } catch (fallbackError) {
      console.error('降级复制方法也失败:', fallbackError);
      ElMessage.error('复制失败，请手动复制');
    }
  }
};

const goBack = () => {
  // 统一使用浏览器历史记录返回上一页
  // 页面状态会在目标页面的 onMounted 中自动恢复（通过 pageState 工具）
  if (window.history.length > 1) {
    router.back();
  } else {
    // 如果没有历史记录，返回到首页
    router.push('/');
  }
};

onBeforeMount(() => {
  // 进入详情页时，滚动到顶部
  window.scrollTo({ top: 0, behavior: 'auto' });
});

onBeforeUnmount(() => {
  // 组件卸载时恢复后台加载
  resumeBackgroundLoading();
});

onMounted(() => {
  // 确保滚动到顶部
  window.scrollTo({ top: 0, behavior: 'auto' });
  loadMovie();
});
</script>

<style scoped>
.movie-detail {
  width: 100%;
  min-height: 100%;
}

.header-content {
  display: flex;
  align-items: center;
}

.el-header {
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.empty-state {
  padding: 40px 0;
}

.movie-content {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.movie-left {
  flex: 0 0 auto;
}

.image-wrapper {
  position: relative;
  width: 100%;
  max-width: 600px;
}

.poster-image {
  width: 100%;
  max-width: 600px;
  cursor: zoom-in;
  transition: transform 0.2s ease;
}

.poster-image:hover {
  transform: scale(1.02);
}

.movie-right {
  flex: 1;
  min-width: 300px;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 600px;
  background: #f5f5f5;
  color: #909399;
  font-size: 14px;
}

.link-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.open-location-btn {
  background-color: #f2c33f;
  border-color: #f2c33f;
  color: #fff;
}

.open-location-btn:hover {
  background-color: #e6b835;
  border-color: #e6b835;
}

.open-location-btn:active {
  background-color: #d9a82a;
  border-color: #d9a82a;
}
</style>

<style>
/* 全局样式：确保预览遮罩可以点击关闭 */
.el-image-viewer__wrapper {
  z-index: 2000;
}

.el-image-viewer__mask {
  cursor: pointer;
}
</style>
