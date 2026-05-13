/**
 * 鋼嵐工具站 — 機師資料自動擷取腳本
 *
 * 功能：
 *   1. 從官方 WIKI 遍歷所有機師
 *   2. 擷取基礎資料、六維屬性（初始/滿級）、天賦、技能、神經驅動
 *   3. 下載機師立繪到 public/images/pilots/
 *   4. 下載技能圖示到 public/images/skills/
 *   5. 輸出完整 public/data/pilots.json
 *
 * 使用方式：
 *   npm install -D playwright
 *   npx playwright install chromium
 *   node scripts/scrape-pilots.js
 *
 * 選項：
 *   --no-images   只擷取資料，不下載圖片
 *   --headless    無頭模式（預設為有視窗，方便觀察）
 *   --limit=10    只處理前 N 個機師（測試用）
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 設定 ──────────────────────────────────────────────────
const WIKI_URL = 'https://ma-community.zlongame.com/#/guidePage/gameinfo';
const OUTPUT_JSON = path.join(__dirname, '../public/data/pilots.json');
const PILOTS_IMG_DIR = path.join(__dirname, '../public/images/pilots');
const SKILLS_IMG_DIR = path.join(__dirname, '../public/images/skills');
const PROGRESS_FILE = path.join(__dirname, '../public/data/pilots_scrape_progress.json');

// 命令列參數解析
const args = process.argv.slice(2);
const DOWNLOAD_IMAGES = !args.includes('--no-images');
const HEADLESS = args.includes('--headless');
const LIMIT = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();

// ── 簡繁對照（常用遊戲詞彙）──────────────────────────────
const S2T = {
  '狙击手': '狙擊手', '突击手': '突擊手', '格斗家': '格鬥家',
  '战术家': '戰術家', '机械师': '機械師', '守护者': '守護者', '调构师': '調構師',
  '轻型': '輕型', '重型': '重型', '中型': '中型',
  '被动技能': '被動技能', '主动技能': '主動技能', '指令': '指令',
  '北陆联合': '北陸聯合', '灰烬之子': '灰燼之子', '联合安全总署': '聯合安全總署',
  '铁血': '鐵血', '弹射': '彈射', '亲卫': '親衛', '协力': '協力',
  '暴击': '暴擊', '命中': '命中', '再攻击': '再攻擊', '击破': '擊破',
  '击毁': '擊毀', '部位': '部位', '技力': '技力',
};

function toTW(text) {
  if (!text) return text;
  let result = text;
  for (const [sc, tc] of Object.entries(S2T)) {
    result = result.replaceAll(sc, tc);
  }
  return result;
}

// ── 圖片下載工具 ──────────────────────────────────────────
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      resolve(destPath); // 已存在則跳過
      return;
    }
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // 處理重定向
        downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // 失敗刪除不完整檔案
      reject(err);
    });
  });
}

// ── 從 tooltip 擷取技能資料 ──────────────────────────────
async function extractTooltipSkill(page) {
  return page.evaluate(() => {
    const el = document.getElementById('game-info-tool-tip');
    if (!el || !el.innerText.trim()) return null;
    const name = el.querySelector('.skill-row1')?.innerText?.trim();
    if (!name) return null;
    const type = el.querySelector('.skill-type')?.innerText?.replace('类型:', '').trim();
    const cost = el.querySelector('.skill-expend')?.innerText?.replace('消耗:', '').trim();
    const weapon = el.querySelector('.skill-row3')?.innerText?.replace('武器:', '').trim();
    const description = el.querySelector('.tool-tip-skill-desc')?.innerText?.trim();
    const statBoost = el.querySelector('.tool-tip-skill-powerdesc')?.innerText?.trim();
    // Parse cooldown if present
    const cooldownEl = el.querySelector('.skill-cd');
    const cooldown = cooldownEl?.innerText?.replace('冷却:', '').trim() || null;
    return { name, type, cost, cooldown, weapon, description, statBoost };
  });
}

// ── 擷取單一機師詳情頁 ──────────────────────────────────
async function extractPilotDetail(page) {
  // 等待詳情頁載入
  await page.waitForSelector('table', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);

  // ── 個人檔案（側欄資訊）
  const profile = await page.evaluate(() => {
    const result = {};
    document.querySelectorAll('[class*="record-wrap-content"]').forEach(el => {
      const key = el.querySelector('[class*="content-attr"]')?.innerText?.trim();
      const val = el.querySelector('[class*="content-text"]')?.innerText?.trim();
      if (key && val) result[key] = val;
    });
    return result;
  });

  // ── 顯示名稱 & 全名
  const name = await page.evaluate(() =>
    document.querySelector('[class*="base-info-name-text"]')?.innerText?.trim()
  );

  // ── 角色簡介（lore）
  const lore = await page.evaluate(() =>
    document.querySelector('[class*="base-info-desc-text"]')?.innerText?.trim()
  );

  // ── 立繪圖片 URL（找 char 相關圖片）
  const portraitUrl = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    // 優先尋找角色立繪（通常在 area1 / base-info 區域，非技能圖示）
    for (const img of imgs) {
      if (img.src && !img.src.includes('Icon_skill') && !img.src.includes('icon')
          && !img.src.includes('logo') && img.naturalWidth > 100) {
        return img.src;
      }
    }
    return null;
  });

  // ── 初始屬性（確保目前是初始狀態）
  const switchToMaxBtn = page.locator('p:has-text("切换至满级满潜")').first();
  const isOnInitial = await switchToMaxBtn.isVisible().catch(() => false);

  const baseStats = await page.evaluate(() => {
    const r = {};
    document.querySelectorAll('table tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const k = cells[i]?.innerText?.trim();
        const v = cells[i + 1]?.innerText?.trim();
        if (k && v) r[k] = v;
      }
    });
    return r;
  });

  // ── 滿級屬性
  if (isOnInitial) {
    await switchToMaxBtn.click({ force: true });
    await page.waitForTimeout(500);
  }

  const maxStats = await page.evaluate(() => {
    const r = {};
    document.querySelectorAll('table tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const k = cells[i]?.innerText?.trim();
        const v = cells[i + 1]?.innerText?.trim();
        if (k && v) r[k] = v;
      }
    });
    return r;
  });

  // ── 天賦
  const talent = await page.evaluate(() => {
    // 找「角色天赋」標題的相鄰容器
    const headers = Array.from(document.querySelectorAll('p'));
    const header = headers.find(p => p.innerText.trim() === '角色天赋');
    if (!header) return null;
    const container = header.closest('[class]');
    const content = container?.querySelector('[class*="blank-content"]');
    const talentName = content?.querySelector('[class*="skill-row1"], [class*="name"]')?.innerText?.trim();
    const talentType = content?.querySelector('[class*="skill-type"]')?.innerText?.replace('类型:', '').trim();
    const description = content?.querySelectorAll('div:last-child')?.[0]?.innerText?.trim();
    return { name: talentName, type: talentType, description };
  });

  // ── 仿生電腦技能（點擊每個圖示取得 tooltip）
  const skillIconSrcs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img[src*="Icon_skill"]')).map(img => img.src)
  );

  const skills = [];
  for (const src of skillIconSrcs) {
    await page.evaluate((s) => {
      document.querySelector(`img[src="${s}"]`)?.click();
    }, src);
    await page.waitForTimeout(350);
    const skill = await extractTooltipSkill(page);
    if (skill?.name) {
      skills.push({ ...skill, iconUrl: src });
    }
  }

  // ── 神經驅動（從 table 結構解析）
  const neuralDrive = await page.evaluate(() => {
    const zones = [];
    const zoneTables = document.querySelectorAll('table');

    zoneTables.forEach(table => {
      const allText = table.innerText;
      if (!allText.includes('区') || !allText.includes('插槽')) return;

      const zone = { name: '', slots: [], levels: [] };
      const rows = table.querySelectorAll('tr');

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
          const text = cell.innerText?.trim();
          if (!text) return;

          // 區域名稱（阿爾法/貝塔/伽馬）
          if (!zone.name && (text.includes('阿尔法') || text.includes('贝塔') || text.includes('伽马'))) {
            zone.name = text.split('\n')[0].trim();
          }

          // 插槽顏色
          const slotMatches = text.matchAll(/(插槽[一二三四五六])\n?(.*?芯片)/g);
          for (const m of slotMatches) {
            zone.slots.push(`${m[1]}：${m[2].trim()}`);
          }

          // 等級效果
          const levelMatches = text.matchAll(/等级([一二三四五六])\n([^\n]+)/g);
          const levelMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
          for (const m of levelMatches) {
            zone.levels.push({ level: levelMap[m[1]] || 0, effect: m[2].trim() });
          }
        });
      });

      if (zone.name) zones.push(zone);
    });
    return zones;
  });

  return { name, profile, lore, portraitUrl, baseStats, maxStats, talent, skills, neuralDrive };
}

// ── 將擷取的原始資料轉換為 JSON schema ─────────────────
function buildPilotJson(raw, index) {
  const STAT_MAP = {
    '格斗': 'melee', '突击': 'assault', '射击': 'shooting',
    '战术': 'tactics', '防御': 'defense', '工程': 'engineering',
  };

  const safeName = (raw.name || 'unknown').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const id = `pilot_${String(index + 1).padStart(3, '0')}_${safeName}`;

  const stats = {};
  const statsBase = {};
  for (const [cn, en] of Object.entries(STAT_MAP)) {
    stats[en] = parseInt(raw.maxStats?.[cn]) || 0;
    statsBase[en] = parseInt(raw.baseStats?.[cn]) || 0;
  }

  // 技能量化數值（從 statBoost 字串解析，如 "射击 +20"）
  function parseStatBoost(statBoost = '') {
    const dmgMatch = statBoost.match(/伤害[^+\d]*\+(\d+)%?/);
    const critMatch = statBoost.match(/暴击率[^+\d]*\+(\d+)%?/);
    return {
      dmg: dmgMatch ? parseInt(dmgMatch[1]) : 0,
      crit: critMatch ? parseInt(critMatch[1]) : 0,
      critDmg: 0,
      acc: 0,
    };
  }

  return {
    id,
    name: toTW(raw.name || ''),
    fullName: toTW(raw.profile?.['姓名'] || raw.name || ''),
    rarity: raw.baseStats?.['品质'] || '',
    class: toTW(raw.baseStats?.['职业'] || ''),
    faction: toTW(raw.baseStats?.['阵营'] || ''),
    license: toTW(raw.baseStats?.['驾驶许可'] || ''),
    masterLevel: raw.maxStats?.['驾驶等级'] || '',
    profile: {
      gender: toTW(raw.profile?.['性别'] || ''),
      bloodType: raw.profile?.['血型'] || '',
      height: raw.profile?.['身高'] || '',
      firstBattle: raw.profile?.['首次作战时间'] || '',
      hobby: toTW(raw.profile?.['业余爱好'] || ''),
    },
    stats,
    statsBase,
    ap: {
      init: parseInt(raw.maxStats?.['技力初始值']) || 0,
      max: parseInt(raw.maxStats?.['技力最大值']) || 0,
      recovery: parseInt(raw.maxStats?.['技力回复值']) || 0,
    },
    apBase: {
      init: parseInt(raw.baseStats?.['技力初始值']) || 0,
      max: parseInt(raw.baseStats?.['技力最大值']) || 0,
      recovery: parseInt(raw.baseStats?.['技力回复值']) || 0,
    },
    talents: raw.talent?.name ? [{
      name: toTW(raw.talent.name),
      type: toTW(raw.talent.type || '被動技能'),
      description: toTW(raw.talent.description || ''),
      dmg: 0, crit: 0, critDmg: 0, acc: 0,
    }] : [],
    skills: (raw.skills || []).map(s => {
      const boost = parseStatBoost(s.statBoost);
      return {
        name: toTW(s.name || ''),
        type: toTW(s.type || ''),
        cost: toTW(s.cost || '-'),
        cooldown: s.cooldown || null,
        weapon: toTW(s.weapon || '-'),
        description: toTW(s.description || ''),
        statBoost: s.statBoost || '',
        iconUrl: s.iconUrl || '',   // 官方 CDN URL（直接引用，不下載）
        icon: `/images/skills/${path.basename(s.iconUrl || 'unknown.png')}`,  // 本地路徑（若下載）
        ...boost,
      };
    }),
    neuralDrive: (raw.neuralDrive || []).map(zone => ({
      name: toTW(zone.name || ''),
      slots: zone.slots.map(toTW),
      levels: zone.levels.map(l => ({ level: l.level, effect: toTW(l.effect) })),
      dmg: 0, crit: 0, critDmg: 0, acc: 0,
    })),
    portraitUrl: raw.portraitUrl || '',          // 官方 CDN URL（直接引用）
    portrait: `/images/pilots/${safeName}.png`,  // 本地路徑（若下載）
    lore: toTW(raw.lore || ''),
    attack: 0,
    defense: 0,
  };
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  console.log('🚀 鋼嵐工具站 — 機師資料擷取腳本');
  console.log(`   圖片下載: ${DOWNLOAD_IMAGES ? '✓' : '✗ (--no-images)'}  |  無頭模式: ${HEADLESS ? '✓' : '✗'}  |  限制: ${isFinite(LIMIT) ? LIMIT : '全部'}`);
  console.log('');

  // 建立圖片目錄
  if (DOWNLOAD_IMAGES) {
    fs.mkdirSync(PILOTS_IMG_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_IMG_DIR, { recursive: true });
  }

  // 載入已儲存進度（續跑）
  let savedProgress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    savedProgress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`📂 發現進度檔，已完成 ${Object.keys(savedProgress).length} 個機師，將跳過已完成項目`);
  }

  const browser = await chromium.launch({ headless: HEADLESS, slowMo: 30 });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  // ── 導航至 WIKI 機師頁 ──
  console.log('🌐 開啟 WIKI...');
  await page.goto('https://ma-community.zlongame.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 步驟1：點擊「Wiki站」按鈕（頂部導覽列）
  console.log('  → 點擊 Wiki站...');
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const el = els.find(e => e.children.length === 0 && e.innerText?.trim() === 'Wiki站');
    el?.click();
  });
  await page.waitForTimeout(3000);

  // 步驟2：點擊「机师」資料分頁
  console.log('  → 點擊機師分頁...');
  await page.evaluate(() => {
    // Wiki 站的資料類別導覽列（机师/机兵/武器/背包/模组/元件）
    const els = Array.from(document.querySelectorAll('*'));
    const el = els.find(e =>
      e.children.length === 0 &&
      e.innerText?.trim() === '机师' &&
      e.closest('[class*="type"], [class*="tab"], [class*="nav"], [class*="info"]')
    );
    el?.click();
  });
  await page.waitForTimeout(3000);

  // ── 偵測是否已成功進入機師列表（等待圖片出現）──
  await page.waitForFunction(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).some(img =>
      img.src && !img.src.includes('Icon_skill') && !img.src.includes('logo') && img.naturalWidth > 50
    );
  }, { timeout: 10000 }).catch(() => console.log('  ⚠ 等待機師圖片超時，繼續嘗試...'));

  // ── 取得機師列表（用圖片 + 短文字段落偵測，去重）──
  const pilotNames = await page.evaluate(() => {
    const seen = new Set();
    const result = [];

    // 方法一：找每個包含角色圖片的容器，取旁邊的短名稱 <p>
    const imgs = Array.from(document.querySelectorAll('img')).filter(img =>
      img.src &&
      !img.src.includes('Icon_skill') &&
      !img.src.includes('logo') &&
      !img.src.includes('bg') &&
      img.src.includes('media') // 官方媒體伺服器
    );

    for (const img of imgs) {
      const container = img.parentElement;
      if (!container) continue;
      const p = container.querySelector('p');
      const name = p?.innerText?.trim();
      if (name && name.length >= 2 && name.length <= 8 && !seen.has(name)) {
        // 排除非中文名稱（導覽列文字等）
        if (/[\u4e00-\u9fa5]/.test(name)) {
          seen.add(name);
          result.push(name);
        }
      }
    }

    // 方法二（備用）：找所有短中文段落，且父容器包含 img
    if (result.length < 3) {
      document.querySelectorAll('p').forEach(p => {
        const name = p.innerText?.trim();
        if (!name || name.length < 2 || name.length > 8) return;
        if (!/[\u4e00-\u9fa5]/.test(name)) return;
        if (seen.has(name)) return;
        const parent = p.parentElement;
        if (parent?.querySelector('img')) {
          seen.add(name);
          result.push(name);
        }
      });
    }

    return result;
  });

  // ── 偵錯：若找到 0 個，印出頁面狀況 ──
  if (pilotNames.length === 0) {
    const pageState = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      imgCount: document.querySelectorAll('img').length,
      pTexts: Array.from(document.querySelectorAll('p')).slice(0, 20).map(p => p.innerText?.trim()).filter(Boolean),
    }));
    console.log('  ⚠ 找不到機師，頁面狀態：', JSON.stringify(pageState, null, 2));
  }

  const targetPilots = pilotNames.slice(0, LIMIT);
  console.log(`📋 找到 ${pilotNames.length} 個機師${isFinite(LIMIT) ? `，本次處理前 ${LIMIT} 個` : ''}`);
  console.log('');

  const results = { ...savedProgress };
  let newCount = 0;

  for (let i = 0; i < targetPilots.length; i++) {
    const pilotName = targetPilots[i];

    // 跳過已完成
    if (savedProgress[pilotName]) {
      console.log(`  [${i + 1}/${targetPilots.length}] ⏭  ${pilotName} (已完成)`);
      continue;
    }

    process.stdout.write(`  [${i + 1}/${targetPilots.length}] ⏳ ${pilotName}...`);

    try {
      // 點擊機師卡片（找包含該名稱的段落，點擊其父容器）
      await page.evaluate((name) => {
        const paras = Array.from(document.querySelectorAll('p'));
        const target = paras.find(p => p.innerText?.trim() === name);
        const container = target?.closest('div') || target?.parentElement;
        container?.click();
      }, pilotName);
      await page.waitForTimeout(1500);

      // 擷取資料
      const raw = await extractPilotDetail(page);
      raw.name = raw.name || pilotName;

      const pilotJson = buildPilotJson(raw, Object.keys(results).length);
      results[pilotName] = pilotJson;
      newCount++;

      process.stdout.write(` ✓  [${pilotJson.class || '?'}] 天賦:${pilotJson.talents.length} 技能:${pilotJson.skills.length} 神驅:${pilotJson.neuralDrive.length}\n`);

      // 下載立繪
      if (DOWNLOAD_IMAGES && raw.portraitUrl) {
        const ext = path.extname(raw.portraitUrl.split('?')[0]) || '.png';
        const safeName = pilotJson.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
        const destPath = path.join(PILOTS_IMG_DIR, `${safeName}${ext}`);
        await downloadImage(raw.portraitUrl, destPath).catch(e =>
          console.error(`    ⚠ 立繪下載失敗: ${e.message}`)
        );
      }

      // 下載技能圖示
      if (DOWNLOAD_IMAGES) {
        for (const skill of (raw.skills || [])) {
          if (skill.iconUrl) {
            const iconFile = path.basename(skill.iconUrl.split('?')[0]);
            const destPath = path.join(SKILLS_IMG_DIR, iconFile);
            await downloadImage(skill.iconUrl, destPath).catch(() => {});
          }
        }
      }

      // 儲存進度（每個機師完成後立即存檔，中斷可續跑）
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(results, null, 2), 'utf-8');

      // 回到機師列表
      await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('*'));
        const el = els.find(e =>
          e.children.length === 0 &&
          e.innerText?.trim() === '机师' &&
          e.closest('[class*="type"], [class*="tab"], [class*="nav"], [class*="info"]')
        );
        el?.click();
      });
      await page.waitForTimeout(1200);

    } catch (err) {
      process.stdout.write(` ✗  ${err.message}\n`);
      // 嘗試恢復：重新載入頁面並回到機師列表
      try {
        await page.goto('https://ma-community.zlongame.com/', { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
          const wikiBtn = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && e.innerText?.trim() === 'Wiki站');
          wikiBtn?.click();
        });
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll('*'));
          const el = els.find(e =>
            e.children.length === 0 &&
            e.innerText?.trim() === '机师' &&
            e.closest('[class*="type"], [class*="tab"], [class*="nav"], [class*="info"]')
          );
          el?.click();
        });
        await page.waitForTimeout(1500);
      } catch (_) {}
    }
  }

  await browser.close();

  // ── 輸出最終 JSON（以 array 格式）──
  const finalArray = Object.values(results);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalArray, null, 2), 'utf-8');

  // 清理進度檔
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }

  console.log('');
  console.log(`✅ 完成！本次新增 ${newCount} 個，共 ${finalArray.length} 個機師`);
  console.log(`📁 JSON 輸出：${OUTPUT_JSON}`);
  if (DOWNLOAD_IMAGES) {
    console.log(`🖼  立繪目錄：${PILOTS_IMG_DIR}`);
    console.log(`🖼  技能圖示：${SKILLS_IMG_DIR}`);
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  process.exit(1);
});
