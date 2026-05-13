/**
 * 鋼嵐工具站 — 機師資料擷取腳本 v2
 *
 * 功能：
 *   1. 從官方 WIKI 遍歷 S 級機師
 *   2. 擷取基礎資料、六維屬性（初始/滿級）、天賦、技能（主動/被動/指令）、神經驅動
 *   3. 下載機師立繪到 public/images/pilots/
 *   4. 下載技能圖示到 public/images/skills/
 *   5. 輸出 public/data/pilots.json（自動跳過已有資料的機師）
 *   6. 輸出 public/data/skillLibrary.json（含武器/攻擊方式/倍率解析）
 *
 * 使用方式：
 *   node scripts/scrape-pilots-v2.js                  ← 全量（自動跳過已有資料）
 *   node scripts/scrape-pilots-v2.js --headless        ← 無視窗背景執行
 *   node scripts/scrape-pilots-v2.js --no-images       ← 只取文字，不下載圖片
 *   node scripts/scrape-pilots-v2.js --pilot=伊夫      ← 指定單一機師（繁體即可）
 *   node scripts/scrape-pilots-v2.js --debug           ← 截圖除錯，存到 public/debug/
 *   node scripts/scrape-pilots-v2.js --limit=3         ← 只跑前 N 個（測試用）
 *   node scripts/scrape-pilots-v2.js --force           ← 強制重新抓（忽略已有資料）
 */

import { chromium } from 'playwright';
import * as OpenCC from 'opencc-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 路徑設定 ──────────────────────────────────────────────────
const WIKI_BASE   = 'https://ma-community.zlongame.com';
const OUTPUT_JSON = path.join(__dirname, '../public/data/pilots.json');
const SKILL_LIB   = path.join(__dirname, '../public/data/skillLibrary.json');
const PILOTS_DIR  = path.join(__dirname, '../public/images/pilots');
const SKILLS_DIR  = path.join(__dirname, '../public/images/skills');
const PROGRESS    = path.join(__dirname, '../public/data/pilots_progress.json');
const DEBUG_DIR   = path.join(__dirname, '../public/debug');

// ── 命令列參數 ────────────────────────────────────────────────
const args             = process.argv.slice(2);
const DOWNLOAD_IMG     = !args.includes('--no-images');
const HEADLESS         = args.includes('--headless');
const DEBUG            = args.includes('--debug');
const FORCE            = args.includes('--force');
const SINGLE_PILOT_RAW = (args.find(a => a.startsWith('--pilot=')) || '').split('=')[1] || '';
const LIMIT            = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();

// ════════════════════════════════════════════════════════════
// 中文轉換（OpenCC）
//   s2t(text)  簡體 → 繁體  ← 處理 WIKI 回傳的文字
//   t2s(text)  繁體 → 簡體  ← 把使用者輸入轉換後送 WIKI 搜尋
// ════════════════════════════════════════════════════════════
const _s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
const _t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });

function s2t(text) { return text ? _s2t(text) : text; }
function t2s(text) { return text ? _t2s(text) : text; }
const tw = s2t; // 向後相容別名

// ── --pilot 繁體輸入 → 簡體搜尋 ──────────────────────────────
const SINGLE_PILOT    = SINGLE_PILOT_RAW ? t2s(SINGLE_PILOT_RAW) : '';
const SINGLE_PILOT_TW = SINGLE_PILOT_RAW;

// ════════════════════════════════════════════════════════════
// 比對現有資料，建立「已抓過」的機師名稱集合
// 同時比對簡體名（WIKI用）和繁體名（JSON裡的name欄位）
// ════════════════════════════════════════════════════════════
function loadExistingPilots() {
  const existing = new Map(); // key: 簡體名 → value: 繁體名（JSON裡的）

  // 從 pilots.json 載入
  if (fs.existsSync(OUTPUT_JSON)) {
    try {
      const arr = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'));
      for (const p of arr) {
        if (!p.name) continue;
        existing.set(t2s(p.name), p.name); // 繁→簡 作為 key
        existing.set(p.name, p.name);       // 繁體本身也記
      }
      if (arr.length > 0) {
        console.log(`📦 pilots.json 已有 ${arr.length} 個機師，將自動跳過`);
      }
    } catch {
      console.log('  ⚠ pilots.json 讀取失敗，視為空白');
    }
  }

  // 從中斷進度檔載入（覆蓋本次中斷的進度）
  if (fs.existsSync(PROGRESS)) {
    try {
      const prog = JSON.parse(fs.readFileSync(PROGRESS, 'utf-8'));
      for (const [name, pilot] of Object.entries(prog)) {
        existing.set(name, pilot.name || name);
        if (pilot.name) existing.set(t2s(pilot.name), pilot.name);
      }
      console.log(`📂 進度檔有 ${Object.keys(prog).length} 筆，合併中...`);
    } catch {}
  }

  return existing;
}

// ── 圖片下載 ──────────────────────────────────────────────────
function downloadImage(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) { reject(new Error('too many redirects')); return; }
    if (fs.existsSync(dest)) { resolve(dest); return; }

    const mod  = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(dest, () => {});
        downloadImage(res.headers.location, dest, depth + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    });

    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// ── 截圖（DEBUG 模式）────────────────────────────────────────
let screenshotIdx = 0;
async function snap(page, label) {
  if (!DEBUG) return;
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const file = path.join(DEBUG_DIR, `${String(++screenshotIdx).padStart(3, '0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  console.log(`    📷 ${file}`);
}

// ── 技能倍率 / 武器 / 攻擊方式解析 ──────────────────────────
function parseSkillMechanics(desc = '', weaponField = '') {
  if (!desc) return {};

  const multipliers = [];
  for (const m of desc.matchAll(/(\d+(?:\.\d+)?)\s*[%％倍×x]/g)) {
    const v = parseFloat(m[1]);
    if (v > 10 && v <= 2000) multipliers.push(v + '%');
    else if (v > 0 && v <= 20) multipliers.push(v + 'x');
  }

  const patterns = [];
  const patternKeys = [
    ['雙手同時', '雙手同時攻擊'], ['同時使用兩把', '雙手同時攻擊'],
    ['雙手', '雙手攻擊'], ['單手', '單手攻擊'],
    ['連續.*?次', '連續攻擊'], ['兩次', '攻擊兩次'], ['三次', '攻擊三次'],
    ['全體', '全體攻擊'], ['範圍', '範圍攻擊'],
    ['貫穿', '貫穿攻擊'], ['蓄力', '蓄力攻擊'],
    ['追加', '追加攻擊'], ['反擊', '反擊'],
  ];
  for (const [kw, label] of patternKeys) {
    if (new RegExp(kw).test(desc) && !patterns.includes(label)) patterns.push(label);
  }

  const weaponTypes = [];
  const weaponKws = [
    '機槍', '狙擊', '步槍', '手槍', '霰彈槍', '榴彈', '火箭',
    '刀', '劍', '拳', '格鬥', '近戰', '突擊步槍', '衝鋒槍',
  ];
  for (const wk of weaponKws) {
    if ((desc + weaponField).includes(wk) && !weaponTypes.includes(wk)) weaponTypes.push(wk);
  }

  return { multipliers, attackPattern: patterns, weaponTypes };
}

// ── 等待並點擊文字（重試版）─────────────────────────────────
async function clickText(page, text, opts = {}) {
  const { timeout = 8000, retries = 2 } = opts;
  for (let i = 0; i <= retries; i++) {
    try {
      await page.getByText(text, { exact: true }).first().click({ timeout });
      return true;
    } catch {
      if (i < retries) await page.waitForTimeout(1000);
    }
  }
  return false;
}

// ── 從 tooltip 讀取技能詳情 ──────────────────────────────────
async function readTooltip(page) {
  return page.evaluate(() => {
    const selectors = [
      '#game-info-tool-tip',
      '[class*="tool-tip"]',
      '[class*="tooltip"]',
      '[class*="skill-detail"]',
      '[class*="skill-info"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el?.innerText?.trim()) continue;
      const text = el.innerText.trim();
      if (text.length < 5) continue;
      return {
        name:        el.querySelector('[class*="skill-row1"], [class*="name"]')?.innerText?.trim(),
        type:        el.querySelector('[class*="skill-type"]')?.innerText?.replace(/^.*?:/, '').trim(),
        cost:        el.querySelector('[class*="expend"], [class*="cost"]')?.innerText?.replace(/^.*?:/, '').trim(),
        weapon:      el.querySelector('[class*="skill-row3"], [class*="weapon"]')?.innerText?.replace(/^.*?:/, '').trim(),
        description: el.querySelector('[class*="desc"]')?.innerText?.trim(),
        statBoost:   el.querySelector('[class*="powerdesc"], [class*="boost"]')?.innerText?.trim(),
        rawText:     text,
      };
    }
    return null;
  });
}

// ── 完整技能擷取 ──────────────────────────────────────────────
async function extractAllSkills(page) {
  const skills    = [];
  const seenNames = new Set();

  // 捲動到底確保技能區塊全部載入
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const iconSrcs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter(img => {
        if (!img.src) return false;
        const src = img.src;
        // URL 模式匹配（不分大小寫）
        if (/[Ii]con_?[Ss]kill|[Ss]kill_?[Ii]con|[Ss]kill[Ii]con|_[Ss]kill\.|[Ss]kill_icon/i.test(src)) return true;
        // 也抓 class 含 skill/talent 的容器內的小圖示
        const parent = img.closest('[class*="skill"],[class*="Skill"],[class*="talent"],[class*="Talent"]');
        if (parent && img.naturalWidth > 0 && img.naturalWidth < 200) return true;
        return false;
      })
      .map(img => img.src)
      .filter((v, i, arr) => arr.indexOf(v) === i)
  );

  console.log(`    🎯 找到 ${iconSrcs.length} 個技能圖示`);

  // 記錄預設 talent panel 的名稱，點擊 computer-map 節點後若 panel 更新則讀取新技能
  const baseTalentName = await page.evaluate(() =>
    document.querySelector('.talent-info-name')?.innerText?.trim() || ''
  );
  const seenPanelNames = new Set(baseTalentName ? [baseTalentName] : []);

  for (const src of iconSrcs) {
    // 捲動到圖示位置
    await page.evaluate((s) => {
      document.querySelector(`img[src="${s}"]`)?.scrollIntoView({ block: 'center' });
    }, src);
    await page.waitForTimeout(300);

    // 先嘗試 hover（tooltip），再嘗試 click
    let skillData = null;
    try {
      await page.hover(`img[src="${src}"]`, { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(600);
      skillData = await readTooltip(page);
    } catch {}

    if (!skillData?.name) {
      await page.evaluate((s) => {
        const img = document.querySelector(`img[src="${s}"]`);
        img?.click();
        img?.parentElement?.click();
      }, src);
      await page.waitForTimeout(1000);
      skillData = await readTooltip(page);
    }

    // 點擊 computer-map-cell 節點後，技能詳情會更新到 talent-info-* panel
    // 若 panel 顯示了新的名稱，代表這是該節點的技能資料
    if (!skillData?.name) {
      const panelName = await page.evaluate(() =>
        document.querySelector('.talent-info-name')?.innerText?.trim() || ''
      );
      if (panelName && !seenPanelNames.has(panelName)) {
        seenPanelNames.add(panelName);
        skillData = await page.evaluate(() => ({
          name:        document.querySelector('.talent-info-name')?.innerText?.trim(),
          type:        document.querySelector('.talent-detail.talent-type .talent-detail-content')?.innerText?.trim(),
          cost:        document.querySelector('.talent-detail.talent-expend .talent-detail-content')?.innerText?.trim(),
          weapon:      document.querySelector('.talent-detail.talent-weapon .talent-detail-content')?.innerText?.trim(),
          description: document.querySelector('.talent-info-desc')?.innerText?.trim(),
          rawText:     document.querySelector('.talent-info-wrap')?.innerText?.trim(),
        }));
      }
    }

    // 從 DOM 直接提取（不需要 tooltip，最後手段）
    if (!skillData?.name) {
      skillData = await page.evaluate((iconSrc) => {
        const img = document.querySelector(`img[src="${iconSrc}"]`);
        if (!img) return null;
        // 往上找包含足夠文字的父層
        let el = img.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!el) break;
          const text = el.innerText?.trim() || '';
          if (text.length > 15) {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length >= 2) return { name: lines[0], rawText: text };
          }
          el = el.parentElement;
        }
        return null;
      }, src);
    }

    if (!skillData) continue;

    const skillName = tw(skillData.name || '');
    if (!skillName || seenNames.has(skillName)) continue;
    seenNames.add(skillName);

    const description = tw(skillData.description || skillData.rawText || '');
    const weapon      = tw(skillData.weapon || '');
    const mechanics   = parseSkillMechanics(description, weapon);

    skills.push({
      name:        skillName,
      type:        tw(skillData.type || ''),
      cost:        tw(skillData.cost || ''),
      weapon,
      description,
      statBoost:   tw(skillData.statBoost || ''),
      iconUrl:     src,
      iconLocal:   `/images/skills/${path.basename(src.split('?')[0])}`,
      mechanics:   { multipliers: mechanics.multipliers, attackPattern: mechanics.attackPattern, weaponTypes: mechanics.weaponTypes, rawText: description },
    });
  }

  // ── Fallback：圖示掃不到時，改用 DOM 結構直接擷取技能 ────────
  if (skills.length === 0) {
    console.log(`    🔄 圖示未找到，改用 DOM 結構擷取技能...`);

    const domSkills = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // 嘗試找技能卡片容器（常見 class 命名）
      const containers = document.querySelectorAll(
        '[class*="skill-item"],[class*="skillItem"],[class*="skill_item"],' +
        '[class*="skill-card"],[class*="skillCard"],[class*="skill_card"],' +
        '[class*="ability-item"],[class*="abilityItem"]'
      );

      for (const c of containers) {
        const t = c.innerText?.trim();
        if (!t || t.length < 3) continue;
        const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
        const name = lines[0];
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const typeLine   = lines.find(l => /类型[：:]/.test(l));
        const costLine   = lines.find(l => /消耗[：:]/.test(l));
        const weaponLine = lines.find(l => /武器[：:]/.test(l));
        results.push({
          name,
          type:    typeLine?.replace(/.*?[：:]/, '').trim()   || '',
          cost:    costLine?.replace(/.*?[：:]/, '').trim()   || '',
          weapon:  weaponLine?.replace(/.*?[：:]/, '').trim() || '',
          rawText: t,
        });
      }

      // 若還是空的，掃描 class*="talent" 區塊內的每一組技能卡
      if (results.length === 0) {
        const talentBlock = document.querySelector('[class*="talent"],[class*="Talent"]');
        if (talentBlock) {
          const blocks = talentBlock.querySelectorAll('[class*="item"],[class*="card"],[class*="row"]');
          for (const b of blocks) {
            const t = b.innerText?.trim();
            if (!t || t.length < 5) continue;
            const lines = t.split('\n').map(l => l.trim()).filter(Boolean)
              .filter(l => !/角色天赋|角色天賦|升级天赋|升級天賦|切換|切换/.test(l));
            if (lines.length < 2) continue;
            const name = lines[0];
            if (!name || seen.has(name)) continue;
            seen.add(name);
            results.push({ name, rawText: t });
          }
        }
      }

      return results;
    });

    for (const s of domSkills) {
      const skillName = tw(s.name || '');
      if (!skillName || seenNames.has(skillName)) continue;
      seenNames.add(skillName);
      const description = tw(s.rawText || '');
      const weapon      = tw(s.weapon || '');
      const mechanics   = parseSkillMechanics(description, weapon);
      skills.push({
        name:        skillName,
        type:        tw(s.type || ''),
        cost:        tw(s.cost || ''),
        weapon,
        description,
        statBoost:   '',
        iconUrl:     '',
        iconLocal:   '',
        mechanics:   { multipliers: mechanics.multipliers, attackPattern: mechanics.attackPattern, weaponTypes: mechanics.weaponTypes, rawText: description },
      });
    }
    console.log(`    🔄 DOM fallback 擷取到 ${skills.length} 個技能`);
  }

  return skills;
}

// ── 從表格解析六維屬性 ────────────────────────────────────────
async function extractStats(page) {
  return page.evaluate(() => {
    const r = {};
    document.querySelectorAll('table tr').forEach(row => {
      const cells = row.querySelectorAll('td, th');
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const k = cells[i]?.innerText?.trim();
        const v = cells[i + 1]?.innerText?.trim();
        if (k && v && !/^\d+$/.test(k)) r[k] = v;
      }
    });
    return r;
  });
}

// ── 擷取單一機師完整資料 ─────────────────────────────────────
async function extractPilotDetail(page, pilotName) {
  await snap(page, `pilot_${pilotName}_loaded`);

  await page.waitForFunction(() => document.querySelectorAll('table').length > 0, { timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  const profile = await page.evaluate(() => {
    const result = {};
    document.querySelectorAll('[class*="record-wrap-content"], [class*="attr-item"]').forEach(el => {
      const k = el.querySelector('[class*="content-attr"], [class*="attr-key"]')?.innerText?.trim();
      const v = el.querySelector('[class*="content-text"], [class*="attr-val"]')?.innerText?.trim();
      if (k && v) result[k] = v;
    });
    return result;
  });

  const name = await page.evaluate(() => {
    for (const sel of ['[class*="base-info-name-text"]', '[class*="pilot-name"]', '[class*="char-name"]', 'h1', 'h2']) {
      const text = document.querySelector(sel)?.innerText?.trim();
      if (text && text.length >= 2 && text.length <= 10) return text;
    }
    return '';
  }) || pilotName;

  const lore = await page.evaluate(() => {
    for (const sel of ['[class*="base-info-desc-text"]', '[class*="pilot-desc"]', '[class*="char-desc"]']) {
      const text = document.querySelector(sel)?.innerText?.trim();
      if (text && text.length > 10) return text;
    }
    return '';
  });

  const portraitUrl = await page.evaluate(() => {
    for (const img of Array.from(document.querySelectorAll('img'))) {
      const src = img.src || '';
      if (!src || src.includes('Icon_skill') || src.includes('logo') || src.includes('banner') || src.includes('bg')) continue;
      if (img.naturalWidth > 80 && img.naturalHeight > 80) return src;
    }
    return null;
  });

  const baseStats = await extractStats(page);

  const switchBtn = page.getByText('切换至满级满潜').first();
  const hasSwitchBtn = await switchBtn.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasSwitchBtn) {
    await switchBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }

  const maxStats = await extractStats(page);
  await snap(page, `pilot_${pilotName}_stats`);

  // 捲動到底再截圖，確認技能區域；同時 dump 頁面文字結構
  if (DEBUG) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await snap(page, `pilot_${pilotName}_mid`);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    await snap(page, `pilot_${pilotName}_bottom`);

    // 把頁面完整文字 dump 出來，用於除錯 DOM 結構
    const dumpText = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(
      path.join(DEBUG_DIR, `${pilotName}_dom_dump.txt`),
      dumpText, 'utf-8'
    );
    console.log(`    📄 DOM dump: ${DEBUG_DIR}/${pilotName}_dom_dump.txt`);

    // 額外 dump：所有 img.src + 技能相關 class，用於診斷技能圖示 URL 模式
    const htmlDebug = await page.evaluate(() => {
      const lines = ['=== 所有 img src ==='];
      for (const img of document.querySelectorAll('img')) {
        if (img.src) lines.push(`[${img.naturalWidth}x${img.naturalHeight}] ${img.src}  class="${img.className}"  parent="${img.parentElement?.className}"`);
      }
      lines.push('', '=== class 含 skill / talent 的元素 ===');
      for (const el of document.querySelectorAll('[class*="skill"],[class*="Skill"],[class*="talent"],[class*="Talent"]')) {
        lines.push(`<${el.tagName} class="${el.className}">: ${el.innerText?.trim().slice(0, 120)}`);
      }
      return lines.join('\n');
    });
    fs.writeFileSync(
      path.join(DEBUG_DIR, `${pilotName}_html_debug.txt`),
      htmlDebug, 'utf-8'
    );
    console.log(`    📄 HTML debug: ${DEBUG_DIR}/${pilotName}_html_debug.txt`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  }

  const talent = await page.evaluate(() => {
    // 嘗試直接找天賦區塊的 class
    for (const sel of ['[class*="talent"]', '[class*="passive"]']) {
      const block = document.querySelector(sel);
      if (!block) continue;
      const text = block.innerText?.trim();
      if (text && text.length > 5) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
          .filter(l => !/角色天賦|角色天赋|切換/.test(l));
        if (lines.length >= 1) return { name: lines[0] || '', description: lines.slice(1).join(' ') };
      }
    }
    // 退而求其次：找帶「角色天赋」標題的鄰近元素
    const header = Array.from(document.querySelectorAll('*'))
      .find(h => h.children.length <= 2 && /角色天赋|角色天賦/.test(h.innerText?.trim()) && h.innerText?.trim().length < 20);
    if (!header) return null;
    let el = header.nextElementSibling || header.parentElement?.nextElementSibling;
    for (let i = 0; i < 8 && el; i++) {
      const text = el.innerText?.trim();
      if (text && text.length > 10 && !/切換/.test(text)) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        return { name: lines[0] || '', description: lines.slice(1).join(' ') };
      }
      el = el.nextElementSibling;
    }
    return null;
  });

  const skills = await extractAllSkills(page);

  const neuralDrive = await page.evaluate(() => {
    const zones   = [];
    const levelMap = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6 };
    document.querySelectorAll('table').forEach(table => {
      if (!(/区|插槽/.test(table.innerText))) return;
      const zone = { name: '', slots: [], levels: [] };
      Array.from(table.querySelectorAll('td')).forEach(cell => {
        const t = cell.innerText?.trim() || '';
        if (!zone.name && /阿尔法|贝塔|伽马/.test(t)) zone.name = t.split('\n')[0].trim();
        for (const m of t.matchAll(/插槽([一二三四五六])\n?([^插]*?芯片)/g)) zone.slots.push(`插槽${m[1]}：${m[2].trim()}`);
        for (const m of t.matchAll(/等级([一二三四五六])\n?([^\n等]+)/g)) zone.levels.push({ level: levelMap[m[1]] || 0, effect: m[2].trim() });
      });
      if (zone.name) zones.push(zone);
    });
    return zones;
  });

  return { name, profile, lore, portraitUrl, baseStats, maxStats, talent, skills, neuralDrive };
}

// ── 組裝最終 JSON ─────────────────────────────────────────────
function buildPilotJson(raw, index) {
  const STAT_MAP = {
    '格斗':'melee', '突击':'assault', '射击':'shooting',
    '战术':'tactics', '防御':'defense', '工程':'engineering',
  };

  const safeName = tw(raw.name || 'unknown').replace(/[^一-龥a-zA-Z0-9]/g, '');
  const id       = `pilot_${String(index + 1).padStart(3, '0')}_${safeName}`;

  const stats     = {};
  const statsBase = {};
  for (const [cn, en] of Object.entries(STAT_MAP)) {
    stats[en]     = parseInt(raw.maxStats?.[cn])  || 0;
    statsBase[en] = parseInt(raw.baseStats?.[cn]) || 0;
  }

  const mapAp = (obj) => ({
    init:     parseInt(obj?.['技力初始值']) || 0,
    max:      parseInt(obj?.['技力最大值']) || 0,
    recovery: parseInt(obj?.['技力回复值']) || 0,
  });

  return {
    id,
    name:        tw(raw.name || ''),
    fullName:    tw(raw.profile?.['姓名'] || raw.name || ''),
    rarity:      tw(raw.baseStats?.['品质'] || 'S'),
    class:       tw(raw.baseStats?.['职业'] || ''),
    faction:     tw(raw.baseStats?.['阵营'] || ''),
    license:     tw(raw.baseStats?.['驾驶许可'] || ''),
    masterLevel: tw(raw.maxStats?.['驾驶等级'] || ''),
    profile: {
      gender:      tw(raw.profile?.['性别'] || ''),
      bloodType:   raw.profile?.['血型'] || '',
      height:      raw.profile?.['身高'] || '',
      firstBattle: tw(raw.profile?.['首次作战时间'] || ''),
      hobby:       tw(raw.profile?.['业余爱好'] || ''),
    },
    stats,
    statsBase,
    ap:     mapAp(raw.maxStats),
    apBase: mapAp(raw.baseStats),
    talents: raw.talent?.name ? [{
      name:        tw(raw.talent.name),
      type:        tw(raw.talent.type || '被動技能'),
      description: tw(raw.talent.description || ''),
      dmg: 0, crit: 0, critDmg: 0, acc: 0,
    }] : [],
    skills: (raw.skills || []).map(s => ({
      name:        s.name,
      type:        s.type,
      cost:        s.cost,
      weapon:      s.weapon,
      description: s.description,
      statBoost:   s.statBoost,
      iconUrl:     s.iconUrl,
      iconLocal:   s.iconLocal,
      dmg: 0, crit: 0, critDmg: 0, acc: 0,
    })),
    neuralDrive: (raw.neuralDrive || []).map(z => ({
      name:   tw(z.name || ''),
      slots:  z.slots.map(tw),
      levels: z.levels.map(l => ({ level: l.level, effect: tw(l.effect) })),
      dmg: 0, crit: 0, critDmg: 0, acc: 0,
    })),
    portraitUrl: raw.portraitUrl || '',
    portrait:    `/images/pilots/${safeName}.png`,
    lore:        tw(raw.lore || ''),
    attack:  0,
    defense: 0,
  };
}

// ── 導航至 WIKI 機師列表 ──────────────────────────────────────
async function navigateToWikiPilots(page) {
  console.log('🌐 開啟 WIKI...');
  await page.goto(WIKI_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await snap(page, 'home');

  console.log('  → 進入 Wiki 站...');
  const wikiClicked = await clickText(page, 'Wiki站');
  if (!wikiClicked) {
    await page.goto(`${WIKI_BASE}/#/wiki`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(2500);
  await snap(page, 'wiki');

  console.log('  → 切換至機師分頁...');
  const pilotTabClicked = await clickText(page, '机师');
  if (!pilotTabClicked) {
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(e =>
        e.children.length === 0 &&
        e.innerText?.trim() === '机师' &&
        e.closest('[class*="type"], [class*="tab"], [class*="nav"], [class*="category"]')
      );
      el?.click();
    });
  }
  // 等 API 回應（SPA 懶加載）
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  // 捲動觸發懶加載
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(2000);

  // 若頁面出現「網路連接異常」，再重試一次（最多 3 次）
  for (let retry = 0; retry < 3; retry++) {
    const hasNetErr = await page.evaluate(() =>
      document.body?.innerText?.includes('网络连接异常')
    );
    if (!hasNetErr) break;
    console.log(`  ⚠ 偵測到網路連接異常，重試 ${retry + 1}/3...`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollBy(0, 1));  // 觸發下拉刷新
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);
  }

  await snap(page, 'pilot_list');
}

// ── 取得機師列表 ──────────────────────────────────────────────
async function getPilotList(page) {
  // 多捲幾次，確保懶加載觸發
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => window.scrollTo(0, 0)); // 回到頂部確保能取到第一張卡
  await page.waitForTimeout(500);

  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('img')).some(img =>
      img.src && !img.src.includes('logo') && img.naturalWidth > 50
    );
  }, { timeout: 20000 }).catch(() => {});

  return page.evaluate(() => {
    const result = [];
    const seen   = new Set();

    const allEls = Array.from(document.querySelectorAll('div, li'));
    for (const el of allEls) {
      const imgs = el.querySelectorAll('img');
      const ps   = el.querySelectorAll('p');
      if (imgs.length !== 1 || ps.length < 1) continue;

      const name = Array.from(ps).find(p => {
        const t = p.innerText?.trim();
        return t && t.length >= 2 && t.length <= 8 && /[一-龥]/.test(t);
      })?.innerText?.trim();

      if (!name || seen.has(name)) continue;

      const qualityText = el.innerText || '';
      const isS = /品质.*?S|S级|★★★|金色/.test(qualityText) ||
                  el.className.toLowerCase().includes('s-') ||
                  imgs[0].src?.includes('_S_') || imgs[0].src?.includes('_s_');

      seen.add(name);
      result.push({ name, isS, qualityHint: qualityText.slice(0, 50) });
    }

    if (result.length < 3) {
      document.querySelectorAll('p').forEach(p => {
        const name = p.innerText?.trim();
        if (!name || name.length < 2 || name.length > 8) return;
        if (!/[一-龥]/.test(name)) return;
        if (seen.has(name)) return;
        if (!p.parentElement?.querySelector('img')) return;
        seen.add(name);
        result.push({ name, isS: false, qualityHint: '' });
      });
    }

    return result;
  });
}

// ── 主流程 ───────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 機師擷取腳本 v2            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  圖片: ${DOWNLOAD_IMG ? '✓' : '✗'}  無頭: ${HEADLESS ? '✓' : '✗'}  除錯截圖: ${DEBUG ? '✓' : '✗'}  強制重抓: ${FORCE ? '✓' : '✗'}`);
  if (SINGLE_PILOT_TW) console.log(`  單一機師: ${SINGLE_PILOT_TW}（搜尋用: ${SINGLE_PILOT}）`);
  if (isFinite(LIMIT))  console.log(`  數量限制: ${LIMIT}`);
  console.log('');

  if (DOWNLOAD_IMG) {
    fs.mkdirSync(PILOTS_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  // ── 載入已有資料（用於跳過判斷）──
  const existingPilots = FORCE ? new Map() : loadExistingPilots();

  // ── 把 pilots.json 現有資料放進 results，確保最終輸出完整 ──
  const results  = {};
  const skillLib = {};

  if (!FORCE && fs.existsSync(OUTPUT_JSON)) {
    try {
      const arr = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'));
      for (const p of arr) {
        const key = t2s(p.name || ''); // 用簡體做 key，與 WIKI 機師名一致
        results[key] = p;
      }
    } catch {}
  }

  if (!FORCE && fs.existsSync(PROGRESS)) {
    try {
      const prog = JSON.parse(fs.readFileSync(PROGRESS, 'utf-8'));
      Object.assign(results, prog);
    } catch {}
  }

  console.log('');

  const browser = await chromium.launch({ headless: HEADLESS, slowMo: 50 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  if (DEBUG) {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('    [browser]', msg.text().slice(0, 100));
    });
  }

  try {
    await navigateToWikiPilots(page);

    let allPilots = await getPilotList(page);

    if (allPilots.length === 0) {
      console.log('⚠  找不到機師列表，印出頁面狀態：');
      const state = await page.evaluate(() => ({
        url:      location.href,
        title:    document.title,
        imgCount: document.querySelectorAll('img').length,
        pTexts:   Array.from(document.querySelectorAll('p')).slice(0, 15).map(p => p.innerText?.trim()).filter(Boolean),
      }));
      console.log(JSON.stringify(state, null, 2));
      await snap(page, 'ERROR_empty_list');
    }

    console.log(`📋 頁面共找到 ${allPilots.length} 個機師`);

    // ── 篩選目標機師 ──
    let targets;
    if (SINGLE_PILOT) {
      targets = allPilots.filter(p => p.name.includes(SINGLE_PILOT));
      if (targets.length === 0) {
        console.log(`  ⚠ 找不到「${SINGLE_PILOT_TW || SINGLE_PILOT}」，改用第一個測試`);
        targets = allPilots.slice(0, 1);
      }
    } else {
      const sOnly = allPilots.filter(p => p.isS);
      targets = sOnly.length > 0 ? sOnly : allPilots;
      console.log(`  → S 級: ${sOnly.length}，全部: ${allPilots.length}`);
      if (sOnly.length === 0) console.log('  ⚠ 無法識別品質，擷取全部（可事後篩選）');
    }

    // ── 比對已有資料，標記要跳過的 ──
    const toSkip = targets.filter(p =>
      !FORCE && (existingPilots.has(p.name) || existingPilots.has(s2t(p.name)))
    );
    const toDo   = targets.filter(p =>
      FORCE || (!existingPilots.has(p.name) && !existingPilots.has(s2t(p.name)))
    );

    console.log(`  → 已有資料: ${toSkip.length} 個（跳過）`);
    console.log(`  → 待擷取:   ${toDo.length} 個`);

    const finalTargets = toDo.slice(0, LIMIT);
    console.log(`  → 本次執行: ${finalTargets.length} 個`);
    if (toSkip.length > 0) {
      console.log(`  ℹ 跳過: ${toSkip.map(p => s2t(p.name)).join('、')}`);
    }
    console.log('');

    let newCount = 0;

    for (let i = 0; i < finalTargets.length; i++) {
      const { name: pilotName } = finalTargets[i];
      process.stdout.write(`  [${i+1}/${finalTargets.length}] ⏳ ${s2t(pilotName)}...`);

      try {
        await page.evaluate((name) => {
          const paras  = Array.from(document.querySelectorAll('p'));
          const target = paras.find(p => p.innerText?.trim() === name);
          const card   = target?.closest('div') || target?.parentElement;
          card?.click();
        }, pilotName);
        await page.waitForTimeout(2000);

        const raw       = await extractPilotDetail(page, pilotName);
        raw.name        = raw.name || s2t(pilotName);

        const pilotJson = buildPilotJson(raw, Object.keys(results).length);
        results[pilotName] = pilotJson;
        newCount++;

        process.stdout.write(` ✓ [${pilotJson.class || '?'}] 技能:${pilotJson.skills.length} 天賦:${pilotJson.talents.length} 神驅:${pilotJson.neuralDrive.length}\n`);

        for (const skill of (raw.skills || [])) {
          skillLib[`${pilotJson.name}_${skill.name}`] = {
            pilotId:     pilotJson.id,
            pilotName:   pilotJson.name,
            pilotClass:  pilotJson.class,
            skillName:   skill.name,
            skillType:   skill.type,
            cost:        skill.cost,
            weapon:      skill.weapon,
            description: skill.description,
            mechanics:   skill.mechanics || {},
            iconUrl:     skill.iconUrl,
            iconLocal:   skill.iconLocal,
          };
        }

        if (DOWNLOAD_IMG && raw.portraitUrl) {
          const ext      = path.extname(raw.portraitUrl.split('?')[0]) || '.png';
          const safeName = pilotJson.name.replace(/[^一-龥a-zA-Z0-9]/g, '');
          await downloadImage(raw.portraitUrl, path.join(PILOTS_DIR, `${safeName}${ext}`))
            .catch(e => console.error(`\n    ⚠ 立繪下載失敗: ${e.message}`));
        }

        if (DOWNLOAD_IMG) {
          for (const skill of (raw.skills || [])) {
            if (!skill.iconUrl) continue;
            await downloadImage(skill.iconUrl, path.join(SKILLS_DIR, path.basename(skill.iconUrl.split('?')[0]))).catch(() => {});
          }
        }

        // 每完成一個就存進度（中斷可續跑）
        fs.writeFileSync(PROGRESS, JSON.stringify(results, null, 2), 'utf-8');

        await page.goBack({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1500);

        if (!page.url().includes('gameinfo')) {
          await navigateToWikiPilots(page);
          allPilots = await getPilotList(page);
        }

      } catch (err) {
        process.stdout.write(` ✗  ${err.message}\n`);
        if (DEBUG) console.error(err.stack);
        try { await navigateToWikiPilots(page); } catch {}
      }
    }

    // ── 輸出最終檔案 ──
    const pilotArray = Object.values(results);
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(pilotArray, null, 2), 'utf-8');

    // skillLibrary 合併現有 + 本次新增
    let existingSkillLib = [];
    if (fs.existsSync(SKILL_LIB)) {
      try { existingSkillLib = JSON.parse(fs.readFileSync(SKILL_LIB, 'utf-8')); } catch {}
    }
    const mergedSkillLib = Object.fromEntries(existingSkillLib.map(s => [`${s.pilotName}_${s.skillName}`, s]));
    Object.assign(mergedSkillLib, skillLib);
    fs.writeFileSync(SKILL_LIB, JSON.stringify(Object.values(mergedSkillLib), null, 2), 'utf-8');

    if (fs.existsSync(PROGRESS)) fs.unlinkSync(PROGRESS);

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log(`✅ 完成！`);
    console.log(`   本次新增: ${newCount} 個機師`);
    console.log(`   合計:     ${pilotArray.length} 個機師`);
    console.log(`   技能庫:   ${Object.values(mergedSkillLib).length} 筆技能`);
    console.log(`   📁 ${OUTPUT_JSON}`);
    console.log(`   📁 ${SKILL_LIB}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  if (DEBUG) console.error(err.stack);
  process.exit(1);
});
