const xml2js = require('xml2js');
const fs = require('fs-extra');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');
const js2xmlparser = require('js2xmlparser');
const path = require('path');

/**
 * 检测文件编码
 * @param {Buffer} buffer - 文件内容
 * @returns {string} - 编码名称
 */
function detectEncoding(buffer) {
  const detected = jschardet.detect(buffer);
  return detected.encoding || 'utf-8';
}

/**
 * 提取XML元素的文本内容
 * xml2js在解析有属性的元素时，会返回对象 { _: 'text', attr: 'value' }
 * 此函数用于提取文本内容，无论是字符串还是对象
 * @param {string|object} value - XML元素值
 * @returns {string} - 文本内容
 */
function extractText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._ !== undefined) {
    return String(value._ || '');
  }
  if (typeof value === 'object' && Array.isArray(value)) {
    // 如果是数组，取第一个元素
    return extractText(value[0]);
  }
  return String(value);
}

/**
 * 解析NFO文件
 * @param {string} nfoPath - NFO文件路径
 * @returns {Promise<Object>} - 解析后的电影数据
 */
async function parseNfoFile(nfoPath) {
  try {
    // 读取文件
    const buffer = await fs.readFile(nfoPath);
    
    // 检测编码
    const encoding = detectEncoding(buffer);
    
    // 转换为UTF-8
    let content;
    if (encoding.toLowerCase() === 'utf-8') {
      content = buffer.toString('utf-8');
    } else {
      content = iconv.decode(buffer, encoding);
    }
    
    // 解析XML
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      explicitRoot: false
    });
    
    const result = await parser.parseStringPromise(content);
    
    // 提取电影数据
    const movie = result.movie || result;
    
    // 处理演员（可能是数组或单个对象）
    let actors = [];
    if (movie.actor) {
      if (Array.isArray(movie.actor)) {
        actors = movie.actor.map(a => {
          if (typeof a === 'object' && a.name) {
            return extractText(a.name);
          }
          return extractText(a);
        });
      } else {
        if (typeof movie.actor === 'object' && movie.actor.name) {
          actors = [extractText(movie.actor.name)];
        } else {
          actors = [extractText(movie.actor)];
        }
      }
    }
    
    // 处理分类（可能是数组或单个字符串）
    let genres = [];
    if (movie.genre) {
      if (Array.isArray(movie.genre)) {
        genres = movie.genre.map(g => extractText(g));
      } else {
        genres = [extractText(movie.genre)];
      }
    }
    
    // 提取所有字段，使用 extractText 处理可能的对象格式
    const title = extractText(movie.title);
    const code = extractText(movie.uniqueid);
    const runtime = movie.runtime ? parseInt(extractText(movie.runtime)) : null;
    const premiered = movie.premiered ? extractText(movie.premiered) : null;
    const director = movie.director ? extractText(movie.director) : null;
    const studio = movie.studio ? extractText(movie.studio) : null;
    
    return {
      title: title || '',
      code: code || '',
      runtime: isNaN(runtime) ? null : runtime,
      premiered: premiered || null,
      director: director || null,
      studio: studio || null,
      actors: actors,
      genres: genres
    };
  } catch (error) {
    console.error(`解析NFO文件失败: ${nfoPath}`, error);
    throw error;
  }
}

/**
 * 写入NFO文件
 * @param {string} nfoPath - NFO文件路径
 * @param {Object} movieData - 电影数据对象
 * @returns {Promise<void>}
 */
async function writeNfoFile(nfoPath, movieData) {
  try {
    // 确保目录存在
    await fs.ensureDir(path.dirname(nfoPath));
    
    // 构建XML对象结构
    const xmlData = {
      '@': {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema'
      },
      title: movieData.title || '',
      runtime: movieData.runtime || null,
      uniqueid: {
        '@': {
          type: 'num',
          default: 'true'
        },
        '#': movieData.code || ''
      },
      genre: movieData.genres && movieData.genres.length > 0 
        ? (movieData.genres.length === 1 ? movieData.genres[0] : movieData.genres)
        : null,
      tag: movieData.genres && movieData.genres.length > 0
        ? movieData.genres.join(' / ')
        : null,
      director: movieData.director || '----',
      premiered: movieData.premiered || null,
      studio: movieData.studio || '----',
      actor: movieData.actors && movieData.actors.length > 0
        ? movieData.actors.map(name => ({ name }))
        : null
    };
    
    // 移除null值
    Object.keys(xmlData).forEach(key => {
      if (xmlData[key] === null || xmlData[key] === undefined) {
        delete xmlData[key];
      }
    });
    
    // 转换为XML字符串
    const xmlString = js2xmlparser.parse('movie', xmlData, {
      declaration: {
        include: true,
        encoding: 'UTF-8',
        standalone: 'yes'
      },
      format: {
        doubleQuotes: true,
        indent: '  '
      }
    });
    
    // 写入文件（使用UTF-8编码，带BOM以确保兼容性）
    const BOM = '\uFEFF';
    await fs.writeFile(nfoPath, BOM + xmlString, 'utf8');
    
    console.log(`NFO文件已写入: ${nfoPath}`);
  } catch (error) {
    console.error(`写入NFO文件失败: ${nfoPath}`, error);
    throw error;
  }
}

module.exports = {
  parseNfoFile,
  detectEncoding,
  writeNfoFile
};
