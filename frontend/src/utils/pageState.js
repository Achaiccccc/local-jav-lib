/**
 * 页面状态管理工具
 * 用于缓存和恢复页面的排序、分页等状态
 */

const STORAGE_PREFIX = 'javlibrary_page_state_';

/**
 * 保存页面状态
 * @param {string} pageKey - 页面标识（如 'home', 'actor_123', 'genre_456'）
 * @param {object} state - 要保存的状态
 */
export function savePageState(pageKey, state) {
  try {
    const key = `${STORAGE_PREFIX}${pageKey}`;
    localStorage.setItem(key, JSON.stringify({
      ...state,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('保存页面状态失败:', error);
  }
}

/**
 * 获取页面状态
 * @param {string} pageKey - 页面标识
 * @param {object} defaultState - 默认状态
 * @returns {object} 页面状态
 */
export function getPageState(pageKey, defaultState = {}) {
  try {
    const key = `${STORAGE_PREFIX}${pageKey}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const state = JSON.parse(stored);
      // 合并默认状态和存储的状态
      return { ...defaultState, ...state };
    }
  } catch (error) {
    console.error('获取页面状态失败:', error);
  }
  return defaultState;
}

/**
 * 清除页面状态
 * @param {string} pageKey - 页面标识
 */
export function clearPageState(pageKey) {
  try {
    const key = `${STORAGE_PREFIX}${pageKey}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('清除页面状态失败:', error);
  }
}

/**
 * 保存滚动位置
 * @param {string} pageKey - 页面标识
 * @param {number|undefined} scrollTop - 滚动位置（可选，如果不提供则从 window 获取）
 */
export function saveScrollPosition(pageKey, scrollTop) {
  try {
    if (!pageKey) {
      return;
    }
    
    // 如果没有提供 scrollTop，从 window 获取
    let scrollValue = scrollTop;
    if (scrollValue === undefined || scrollValue === null) {
      scrollValue = window.scrollY || document.documentElement.scrollTop || 0;
    }
    
    // 确保是数字类型
    const numValue = typeof scrollValue === 'number' ? scrollValue : (typeof scrollValue === 'string' ? parseInt(scrollValue, 10) : 0);
    if (isNaN(numValue)) {
      return;
    }
    
    const key = `${STORAGE_PREFIX}${pageKey}_scroll`;
    sessionStorage.setItem(key, numValue.toString());
  } catch (error) {
    console.error('保存滚动位置失败:', error);
  }
}

/**
 * 获取滚动位置
 * @param {string} pageKey - 页面标识
 * @returns {number} 滚动位置
 */
export function getScrollPosition(pageKey) {
  try {
    if (!pageKey) {
      return 0;
    }
    const key = `${STORAGE_PREFIX}${pageKey}_scroll`;
    const stored = sessionStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch (error) {
    console.error('获取滚动位置失败:', error);
    return 0;
  }
}

/**
 * 恢复滚动位置到 window
 * @param {string} pageKey - 页面标识
 * @param {number} delay - 延迟时间（毫秒），默认 100
 */
export function restoreScrollPosition(pageKey, delay = 100) {
  try {
    if (!pageKey) {
      return;
    }
    const scrollTop = getScrollPosition(pageKey);
    if (scrollTop > 0) {
      // 使用 setTimeout 确保 DOM 已完全渲染
      setTimeout(() => {
        window.scrollTo({
          top: scrollTop,
          behavior: 'auto' // 不使用平滑滚动，直接跳转
        });
      }, delay);
    }
  } catch (error) {
    console.error('恢复滚动位置失败:', error);
  }
}

/**
 * 清除滚动位置
 * @param {string} pageKey - 页面标识
 */
export function clearScrollPosition(pageKey) {
  try {
    const key = `${STORAGE_PREFIX}${pageKey}_scroll`;
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error('清除滚动位置失败:', error);
  }
}
