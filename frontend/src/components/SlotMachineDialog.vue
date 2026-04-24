<template>
  <el-dialog
    v-model="dialogVisible"
    title="随机摸奖"
    width="676px"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    class="slot-dialog"
    @closed="onDialogClosed"
  >
    <div v-if="loading" class="slot-loading">正在随机选取影片…</div>
    <template v-else-if="slotMovies.length >= 18">
      <div class="slot-machine-wrap">
        <SlotMachine
          ref="slotRef"
          width="624"
          height="416"
          :blocks="blocks"
          :prizes="prizes"
          :slots="slots"
          :default-style="defaultStyle"
          :default-config="defaultConfig"
          @end="onSlotEnd"
        />
      </div>
      <div v-if="hasStopped" class="slot-result">
        <span class="slot-result-label">中间一行可点击进入详情：</span>
        <div class="slot-result-cards">
          <a
            v-for="m in middleMovies"
            :key="m.id"
            href="javascript:;"
            class="slot-result-card"
            @click="goToDetail(m)"
          >
            <div class="slot-result-poster-wrap">
              <img
                v-if="posterUrls[m.id]"
                :src="posterUrls[m.id]"
                class="slot-result-poster"
                alt=""
              />
              <div v-else class="slot-result-poster slot-result-poster-placeholder">暂无封面</div>
            </div>
            <span class="slot-result-title">{{ m.title || m.code }}</span>
          </a>
        </div>
      </div>
      <div class="slot-actions">
        <el-button @click="openRangeDialog">选择随机范围</el-button>
        <el-button type="primary" @click="playAgain">再来一次</el-button>
      </div>
    </template>
    <template v-else>
      <div class="slot-empty">
        <span>影片数量不足 18 条，请</span>
        <el-button type="primary" link @click="openRangeDialog">重新选择分类</el-button>
      </div>
    </template>
  </el-dialog>

  <el-dialog
    v-model="rangeDialogVisible"
    title="选择随机范围"
    width="760px"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    class="slot-range-dialog"
  >
    <div class="range-filter-groups" v-if="filterGroupList.length">
      <div
        v-for="group in filterGroupList"
        :key="group.key"
        class="range-filter-group"
      >
        <div class="range-filter-group-row">
          <span class="range-filter-group-label">{{ group.label }}：</span>
          <div class="range-filter-group-tags">
            <el-check-tag
              v-for="opt in group.options"
              :key="opt.value"
              :checked="(selectedValues[group.key] || []).includes(opt.value)"
              @click="handleTagClick(group, opt)"
              class="range-filter-tag"
            >
              {{ opt.label }}
            </el-check-tag>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="slot-empty">暂无可选分类数据</div>
    <template #footer>
      <div class="range-actions">
        <el-button @click="clearRange">清空</el-button>
        <el-button type="primary" @click="confirmRangeAndPlay">再来一次</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
defineOptions({ name: 'SlotMachineDialog' });
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { SlotMachine } from '@lucky-canvas/vue';
import { buildFilterGroups } from '../config/genres';
import { useGenreCategoriesStore } from '../stores/genreCategoriesStore';

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const router = useRouter();
const genreStore = useGenreCategoriesStore();
const slotRef = ref(null);
const loading = ref(false);
const slotMovies = ref([]);
const posterUrls = ref({}); // movie.id -> 封面 data URL / blob URL
const hasStopped = ref(false);
const stopTimer = ref(null);
const rangeDialogVisible = ref(false);
const filterGroupList = ref([]);
const selectedValues = ref({});

const SLOT_COUNT = 18;
// 每列停止时显示的奖品索引（0-17）：列0 中间行=2，列1=8，列2=14
const STOP_PRIZE_INDEXES = [2, 8, 14];

const blocks = ref([
  {
    padding: '8px',
    background: 'var(--el-fill-color-light, #f5f7fa)',
    borderRadius: '8px'
  }
]);

const defaultStyle = {
  fontSize: '14px',
  fontColor: '#303133',
  background: 'rgba(255,255,255,0.9)',
  borderRadius: '6px',
  wordWrap: true,
  lengthLimit: '85%'
};

const defaultConfig = {
  mode: 'vertical',
  speed: 18,
  accelerationTime: 1200,
  decelerationTime: 1200,
  rowSpacing: 4,
  colSpacing: 8
};

const prizes = computed(() => {
  const list = slotMovies.value.slice(0, SLOT_COUNT);
  const urls = posterUrls.value;
  return list.map((m) => {
    const prize = {};
    if (urls[m.id]) {
      // 格内仅展示封面图，不显示文字
      prize.imgs = [{ src: urls[m.id], top: '0%', width: '66%', height: '100%' }];
    }
    return prize;
  });
});

const slots = computed(() => [
  { order: [0, 1, 2, 3, 4, 5],direction: 1 },
  { order: [6, 7, 8, 9, 10, 11],direction: -1 },
  { order: [12, 13, 14, 15, 16, 17],direction: 1 }
]);

const middleMovies = computed(() => {
  const list = slotMovies.value;
  if (list.length < 18) return [];
  return STOP_PRIZE_INDEXES.map((idx) => list[idx]).filter(Boolean);
});

const selectedGenreNames = computed(() => {
  const result = new Set();
  filterGroupList.value.forEach((group) => {
    if (group.type !== 'genre') return;
    const values = selectedValues.value[group.key] || [];
    values.forEach((v) => {
      if (v !== 'all') result.add(v);
    });
  });
  return Array.from(result);
});

const selectedYears = computed(() => {
  const yearGroup = filterGroupList.value.find((g) => g.type === 'year');
  if (!yearGroup) return [];
  const values = selectedValues.value[yearGroup.key] || [];
  return values.filter((v) => v !== 'all');
});

function initFilterState() {
  const state = {};
  filterGroupList.value.forEach((group) => {
    const opts = group.options || [];
    const hasAll = opts.some((o) => o.value === 'all');
    state[group.key] = hasAll ? ['all'] : [];
  });
  selectedValues.value = state;
}

function ensureFilterGroupState() {
  const groups = buildFilterGroups(genreStore.categories);
  filterGroupList.value = groups;
  const next = {};
  groups.forEach((group) => {
    const opts = group.options || [];
    const validValues = new Set(opts.map((opt) => opt.value));
    const current = Array.isArray(selectedValues.value[group.key]) ? selectedValues.value[group.key] : [];
    const filtered = current.filter((v) => validValues.has(v));
    const hasAll = validValues.has('all');
    if (filtered.length === 0) {
      next[group.key] = hasAll ? ['all'] : [];
    } else if (filtered.includes('all') && filtered.length > 1) {
      next[group.key] = filtered.filter((v) => v !== 'all');
    } else {
      next[group.key] = filtered;
    }
  });
  selectedValues.value = next;
}

function handleTagClick(group, option) {
  const key = group.key;
  const value = option.value;
  const current = selectedValues.value[key] ? [...selectedValues.value[key]] : [];
  if (value === 'all') {
    selectedValues.value[key] = ['all'];
    return;
  }
  const index = current.indexOf(value);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(value);
  }
  if (current.length === 0) {
    const hasAll = (group.options || []).some((o) => o.value === 'all');
    selectedValues.value[key] = hasAll ? ['all'] : [];
  } else {
    selectedValues.value[key] = current.filter((v) => v !== 'all');
  }
}

async function loadPosterImages() {
  const list = slotMovies.value.slice(0, SLOT_COUNT);
  if (!list.length) return;
  const next = {};
  await Promise.all(
    list.map(async (m) => {
      if (!m.poster_path) return;
      try {
        const url = await window.electronAPI.movies.getImage(m.poster_path, m.data_path_index ?? 0);
        if (url) next[m.id] = url;
      } catch (_) {}
    })
  );
  posterUrls.value = { ...posterUrls.value, ...next };
}

async function fetchRandom() {
  loading.value = true;
  hasStopped.value = false;
  posterUrls.value = {};
  try {
    const res = await window.electronAPI.movies.getRandomList({
      count: SLOT_COUNT,
      filterGenres: selectedGenreNames.value,
      filterYears: selectedYears.value
    });
    if (res?.success && Array.isArray(res.data)) {
      slotMovies.value = res.data;
      await loadPosterImages();
      if (slotMovies.value.length >= 18) {
        setTimeout(() => startPlay(), 200);
      }
    } else {
      slotMovies.value = [];
    }
  } catch (e) {
    console.error(e);
    slotMovies.value = [];
  } finally {
    loading.value = false;
  }
}

function startPlay() {
  if (slotMovies.value.length < 18 || !slotRef.value) return;
  hasStopped.value = false;
  slotRef.value.init?.();
  slotRef.value.play?.();
  if (stopTimer.value) clearTimeout(stopTimer.value);
  stopTimer.value = setTimeout(() => {
    stopTimer.value = null;
    slotRef.value?.stop?.(STOP_PRIZE_INDEXES);
  }, 2000);
}

function onSlotEnd() {
  hasStopped.value = true;
}

function goToDetail(movie) {
  if (!movie?.id) return;
  unlockBodyScroll();
  router.push(`/movie/${movie.id}`);
}

function playAgain() {
  fetchRandom();
}

function clearRange() {
  initFilterState();
}

function openRangeDialog() {
  rangeDialogVisible.value = true;
}

function confirmRangeAndPlay() {
  rangeDialogVisible.value = false;
  fetchRandom();
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  document.body.style.width = '';
  document.body.classList.remove('el-popup-parent--hidden');
}

function onDialogClosed() {
  if (stopTimer.value) {
    clearTimeout(stopTimer.value);
    stopTimer.value = null;
  }
  slotMovies.value = [];
  posterUrls.value = {};
  hasStopped.value = false;
  unlockBodyScroll();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      genreStore.load();
      ensureFilterGroupState();
      fetchRandom();
    }
  }
);

watch(
  () => genreStore.categories,
  () => {
    ensureFilterGroupState();
  },
  { deep: true, immediate: true }
);
</script>

<style scoped>
.slot-loading,
.slot-empty {
  padding: 52px 26px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
.slot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.slot-machine-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 416px;
  margin-bottom: 16px;
}
.slot-result {
  margin-bottom: 20px;
  padding: 14px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}
.slot-result-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  display: block;
  margin-bottom: 8px;
}
.slot-result-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}
.slot-result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 130px;
  text-decoration: none;
  color: var(--el-text-color-primary);
  border-radius: 6px;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.slot-result-card:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.slot-result-poster-wrap {
  width: 100%;
  aspect-ratio: 2/3;
  background: var(--el-fill-color);
  border-radius: 4px;
  overflow: hidden;
}
.slot-result-poster {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.slot-result-poster-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.slot-result-title {
  font-size: 13px;
  margin-top: 6px;
  text-align: center;
  line-height: 1.3;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.slot-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.range-filter-groups {
  max-height: 58vh;
  overflow: auto;
  padding-right: 4px;
}

.range-filter-group {
  margin-bottom: 8px;
}

.range-filter-group-row {
  display: flex;
  align-items: flex-start;
}

.range-filter-group-label {
  font-weight: bold;
  font-size: 13px;
  color: var(--content-title-color, #303133);
  padding-right: 8px;
  flex-shrink: 0;
  line-height: 28px;
}

.range-filter-group-tags {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.range-filter-tag {
  font-size: 12px;
}

.range-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
