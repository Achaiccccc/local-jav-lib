/**
 * 加载优化工具
 * 在用户操作时暂停后台任务，优先处理用户请求
 */
import { pauseBackgroundLoading, resumeBackgroundLoading } from './imageLoader';

/**
 * 包装数据加载函数，自动处理暂停/恢复后台加载
 * @param {Function} loadFunction - 数据加载函数（返回Promise）
 * @returns {Function} - 包装后的加载函数
 */
export function withLoadingOptimization(loadFunction) {
  return async (...args) => {
    // 暂停后台图片加载，优先处理用户请求
    pauseBackgroundLoading();
    
    try {
      const result = await loadFunction(...args);
      // 数据加载完成后，恢复后台加载
      resumeBackgroundLoading();
      return result;
    } catch (error) {
      // 即使失败也恢复后台加载
      resumeBackgroundLoading();
      throw error;
    }
  };
}

/**
 * 暂停后台加载（用于用户操作开始时）
 */
export function pauseForUserAction() {
  pauseBackgroundLoading();
}

/**
 * 恢复后台加载（用于用户操作完成后）
 */
export function resumeAfterUserAction() {
  resumeBackgroundLoading();
}
