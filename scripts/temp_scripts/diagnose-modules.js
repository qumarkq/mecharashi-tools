/**
 * 診斷腳本 v3：驗證更新後的 identifyMasterItems 邏輯，列出所有會被擷取的 master
 * 使用方式：node scripts/diagnose-modules.js
 */

import * as OpenCC from 'opencc-js';
import https from 'https';

const API_BASE = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY  = '1616148215678';

const _s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
function s2t(text) { return text ? _s2t(text) : text; }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function apiUrl(target, type, query = '') {
  let url = `${API_BASE}?appkey=${APP_KEY}&target=${target}&type=${type}`;
  if (query) url += `&query=${encodeURIComponent(query)}`;
  return url;
}

async function fetchModuleDetail(id) {
  const res = await fetchJson(apiUrl('module_data', 'detail', id));
  return res.data?.data || null;
}

function isUniversalModule(nameTW) {
  return /[ⅠⅡⅢ]/.test(nameTW)
    || /·\s*I{1,3}$/.test(nameTW)
    || /\s+I{1,3}$/.test(nameTW)
    || /[一-鿿]I{1,3}$/.test(nameTW);
}

async function identifyMasterItems(list) {
  const fourDigitItems = list.filter(item => item.ID.toString().length <= 4);
  const fiveDigitItems = list.filter(item => item.ID.toString().length === 5);
  const fourDigitIds   = new Set(fourDigitItems.map(item => item.ID.toString()));

  const groups = new Map();
  for (const item of fiveDigitItems) {
    const root = Math.floor(item.ID / 10).toString();
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  }

  const potentialNewMasterItems = [];
  for (const [root, items] of groups) {
    const names = [...new Set(items.map(i => i.name || i.ModuleName || ''))];
    if (fourDigitIds.has(root) && names.length === 1) continue;
    for (const item of items) potentialNewMasterItems.push(item);
  }

  process.stdout.write(`  → 驗證 ${potentialNewMasterItems.length} 個疑似新 master...`);

  const confirmedNewMasters = [];
  for (const item of potentialNewMasterItems) {
    try {
      const detail = await fetchModuleDetail(item.ID.toString());
      if (detail && (detail.mappingIds?.length ?? 0) > 0) {
        confirmedNewMasters.push(item);
      }
      await new Promise(r => setTimeout(r, 150));
    } catch { /* skip */ }
  }

  console.log(` 確認 ${confirmedNewMasters.length} 個新 master`);
  return [...fourDigitItems, ...confirmedNewMasters];
}

async function main() {
  console.log('📡 擷取模組清單...');
  const res  = await fetchJson(apiUrl('module_data', 'list'));
  const list = res.data?.data || [];
  console.log(`  共 ${list.length} 條目\n`);

  const masterItems = await identifyMasterItems(list);
  console.log(`  → 最終 master 總數: ${masterItems.length} 個\n`);

  // 模擬 slot 分類（需要 detail，這裡只做名稱預估）
  let count4 = 0, count8 = 0, countUni = 0, countUnknown = 0;
  const newFiveDigit = masterItems.filter(item => item.ID.toString().length === 5);

  console.log('🆕 新增的 5 位數 master 模組：');
  for (const item of newFiveDigit) {
    const name = s2t(item.name || item.ModuleName || '');
    console.log(`  ID=${item.ID}  ${name}`);
  }

  // 搜尋出力模組
  console.log('\n🔍 出力模組相關：');
  for (const item of masterItems) {
    const name = s2t(item.name || item.ModuleName || '');
    if (name.includes('出力')) {
      console.log(`  ID=${item.ID}  ${name}`);
    }
  }

  // 驗證幾個新 master 的 detail
  if (newFiveDigit.length > 0) {
    console.log('\n📋 新 5 位數 master 的 detail：');
    for (const item of newFiveDigit) {
      const detail = await fetchModuleDetail(item.ID.toString());
      const name = s2t(detail?.name || item.name || '');
      const lvCount = detail?.mappingIds?.length || 0;
      const firstLvName = s2t(detail?.mappingIds?.[0]?.name || '');
      const uni = isUniversalModule(name) || isUniversalModule(firstLvName);
      console.log(`  ID=${item.ID}  ${name}  lv=${lvCount}  slot=${lvCount>=8?'8級模組':uni?'通用模組':'特性模組'}  firstLv=${firstLvName}`);
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

main().catch(err => {
  console.error('❌ 錯誤：', err.message);
  process.exit(1);
});
