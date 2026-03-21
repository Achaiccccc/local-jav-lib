const { app } = require('electron');
const fs = require('fs-extra');
const path = require('path');

const DEFAULT_FOLDER_ID = 'default';
const DEFAULT_FOLDER_NAME = '默认收藏夹';
/** 最近看过：仅播放时写入，数据结构与收藏相同，超过 30 天自动剔除 */
const RECENT_WATCHED_FOLDER_ID = 'recent_watched';
const RECENT_WATCHED_FOLDER_NAME = '最近看过';
const RECENT_WATCHED_MAX_MS = 30 * 24 * 60 * 60 * 1000;
const FILENAME = process.env.NODE_ENV === 'development' ? 'favorites-dev.json' : 'favorites.json';

function getFavoritesPath() {
  return path.join(app.getPath('userData'), FILENAME);
}

/** 单条收藏：{ code, addedAt }，addedAt 为 ISO 字符串 */
function normalizeItem(entry) {
  if (entry && typeof entry === 'object' && typeof entry.code === 'string') {
    return { code: entry.code.trim(), addedAt: entry.addedAt || new Date().toISOString() };
  }
  if (typeof entry === 'string' && entry.trim()) {
    return { code: entry.trim(), addedAt: new Date().toISOString() };
  }
  return null;
}

function ensureRecentWatchedFolder(data) {
  const idx = data.folders.findIndex(f => f.id === RECENT_WATCHED_FOLDER_ID);
  const entry = {
    id: RECENT_WATCHED_FOLDER_ID,
    name: RECENT_WATCHED_FOLDER_NAME,
    isDefault: true,
    isRecentWatched: true
  };
  if (idx === -1) {
    const di = data.folders.findIndex(f => f.id === DEFAULT_FOLDER_ID);
    const insertAt = di >= 0 ? di + 1 : 0;
    data.folders.splice(insertAt, 0, entry);
  } else {
    Object.assign(data.folders[idx], entry);
  }
  if (!Array.isArray(data.items[RECENT_WATCHED_FOLDER_ID])) {
    data.items[RECENT_WATCHED_FOLDER_ID] = [];
  }
}

function pruneExpiredRecentWatched(data) {
  if (!data.items || !Array.isArray(data.items[RECENT_WATCHED_FOLDER_ID])) return false;
  const cutoff = Date.now() - RECENT_WATCHED_MAX_MS;
  const before = data.items[RECENT_WATCHED_FOLDER_ID].length;
  data.items[RECENT_WATCHED_FOLDER_ID] = data.items[RECENT_WATCHED_FOLDER_ID].filter(it => {
    if (!it || typeof it !== 'object' || !it.code) return false;
    const t = it.addedAt ? Date.parse(it.addedAt) : 0;
    return t >= cutoff;
  });
  return before !== data.items[RECENT_WATCHED_FOLDER_ID].length;
}

function ensureFile() {
  const filePath = getFavoritesPath();
  if (!fs.existsSync(filePath)) {
    const data = {
      folders: [
        { id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME, isDefault: true },
        {
          id: RECENT_WATCHED_FOLDER_ID,
          name: RECENT_WATCHED_FOLDER_NAME,
          isDefault: true,
          isRecentWatched: true
        }
      ],
      items: {
        [DEFAULT_FOLDER_ID]: [],
        [RECENT_WATCHED_FOLDER_ID]: []
      }
    };
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

function read() {
  ensureFile();
  const raw = fs.readFileSync(getFavoritesPath(), 'utf-8');
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.folders)) data.folders = [{ id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME, isDefault: true }];
    if (typeof data.items !== 'object') data.items = {};
    if (!data.folders.some(f => f.id === DEFAULT_FOLDER_ID)) {
      data.folders.unshift({ id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME, isDefault: true });
    }
    ensureRecentWatchedFolder(data);
    // 迁移：将 items[folderId] 从 string[] 转为 { code, addedAt }[]；原数组顺序视为先加入的在前，故 i 越大越早
    for (const f of data.folders) {
      if (!Array.isArray(data.items[f.id])) data.items[f.id] = [];
      const list = data.items[f.id];
      const normalized = list
        .map((entry, i) => {
          const item = normalizeItem(entry);
          if (!item) return null;
          if (!item.addedAt) item.addedAt = new Date(Date.now() - (list.length - 1 - i) * 1000).toISOString();
          return item;
        })
        .filter(Boolean);
      const seen = new Set();
      data.items[f.id] = normalized.filter(x => {
        if (seen.has(x.code)) return false;
        seen.add(x.code);
        return true;
      });
    }
    if (!Array.isArray(data.items[DEFAULT_FOLDER_ID])) data.items[DEFAULT_FOLDER_ID] = [];
    const needWrite = pruneExpiredRecentWatched(data);
    if (needWrite) {
      write(data);
    }
    return data;
  } catch (e) {
    const data = {
      folders: [
        { id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME, isDefault: true },
        {
          id: RECENT_WATCHED_FOLDER_ID,
          name: RECENT_WATCHED_FOLDER_NAME,
          isDefault: true,
          isRecentWatched: true
        }
      ],
      items: {
        [DEFAULT_FOLDER_ID]: [],
        [RECENT_WATCHED_FOLDER_ID]: []
      }
    };
    fs.writeFileSync(getFavoritesPath(), JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
}

function write(data) {
  const filePath = getFavoritesPath();
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getFolders() {
  const data = read();
  return data.folders.filter(f => {
    if (f.id === RECENT_WATCHED_FOLDER_ID) {
      const list = data.items[f.id] || [];
      return list.length > 0;
    }
    return true;
  });
}

function createFolder(name) {
  const data = read();
  const id = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  data.folders.push({ id, name: (name || '').trim() || '未命名', isDefault: false });
  data.items[id] = [];
  write(data);
  return id;
}

function updateFolder(id, name) {
  if (id === DEFAULT_FOLDER_ID || id === RECENT_WATCHED_FOLDER_ID) return false;
  const data = read();
  const folder = data.folders.find(f => f.id === id);
  if (!folder) return false;
  folder.name = (name || '').trim() || '未命名';
  write(data);
  return true;
}

function deleteFolder(id) {
  if (id === DEFAULT_FOLDER_ID || id === RECENT_WATCHED_FOLDER_ID) return false;
  const data = read();
  data.folders = data.folders.filter(f => f.id !== id);
  delete data.items[id];
  write(data);
  return true;
}

function getFoldersContainingMovie(movieCode) {
  if (!movieCode || typeof movieCode !== 'string') return [];
  const data = read();
  const code = movieCode.trim();
  return data.folders.filter(f => {
    if (f.id === RECENT_WATCHED_FOLDER_ID) return false;
    const list = Array.isArray(data.items[f.id]) ? data.items[f.id] : [];
    return list.some(it => it && (it.code === code || (typeof it === 'string' && it === code)));
  }).map(f => f.id);
}

function setMovieFolders(movieCode, folderIds) {
  if (!movieCode || typeof movieCode !== 'string') return;
  const data = read();
  const code = movieCode.trim();
  const ids = Array.isArray(folderIds) ? folderIds.filter(Boolean) : [];
  const addedAt = new Date().toISOString();
  for (const f of data.folders) {
    if (f.id === RECENT_WATCHED_FOLDER_ID) continue;
    if (!data.items[f.id]) data.items[f.id] = [];
    const list = data.items[f.id];
    const idx = list.findIndex(it => (it && it.code) === code);
    if (ids.includes(f.id)) {
      if (idx === -1) {
        list.push({ code, addedAt });
      } else {
        list[idx].addedAt = addedAt;
        list.splice(idx, 1);
        list.push({ code, addedAt });
      }
    } else {
      if (idx !== -1) list.splice(idx, 1);
    }
  }
  write(data);
}

/** 返回该收藏夹下的 code 列表，按收藏时间倒序（最新在前） */
function getCodesByFolder(folderId) {
  const data = read();
  const list = Array.isArray(data.items[folderId]) ? data.items[folderId] : [];
  const withTime = list
    .map(it => (it && typeof it === 'object' ? it : { code: String(it), addedAt: '' }))
    .filter(it => it.code);
  withTime.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  return withTime.map(it => it.code);
}

/** 成功播放后调用：更新「最近看过」中的记录时间（仅写入该虚拟夹，不走收藏勾选逻辑） */
function recordRecentPlay(movieCode) {
  if (!movieCode || typeof movieCode !== 'string') return;
  const data = read();
  ensureRecentWatchedFolder(data);
  pruneExpiredRecentWatched(data);
  const code = movieCode.trim();
  if (!code) return;
  const list = Array.isArray(data.items[RECENT_WATCHED_FOLDER_ID])
    ? data.items[RECENT_WATCHED_FOLDER_ID]
    : [];
  const next = list.filter(it => it && it.code !== code);
  next.push({ code, addedAt: new Date().toISOString() });
  data.items[RECENT_WATCHED_FOLDER_ID] = next;
  write(data);
}

module.exports = {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFoldersContainingMovie,
  setMovieFolders,
  getCodesByFolder,
  recordRecentPlay,
  DEFAULT_FOLDER_ID,
  RECENT_WATCHED_FOLDER_ID
};
