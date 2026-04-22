/**
 * KakaoTalk chat import script  (v2 – improved title + English filter)
 * Usage: node scripts/import-kakao.mjs [--dry-run]
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const DB_PATH   = path.join(ROOT, "data", "firstfruits.sqlite");
const CHAT_PATH = "C:/Users/ntoya/Desktop/KakaoTalk_20260416_2135_22_380_group.txt";
const DRY_RUN   = process.argv.includes("--dry-run");

// ── YouTube helpers ──────────────────────────────────────────────────────────

function youtubeId(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be")          return u.pathname.slice(1).split("?")[0].split("/")[0];
    if (h.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch"))   return u.searchParams.get("v") || "";
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || "";
    }
    return "";
  } catch { return ""; }
}

function youtubeThumb(url) {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── classify category — title takes priority over context ────────────────────

function classifyCategory(title, context) {
  // Title is the strongest signal; check it first
  const tit = title.toLowerCase();
  if (/예배/.test(tit))                                                   return "worship";
  if (/총무\s*미팅|전체\s*총무|정기\s*모임|조모임/.test(tit))             return "meeting";
  if (/milk|밀크/.test(tit))                                             return "milk";
  if (/세미나|덕양|연천|어르신|gospel seminar/.test(tit))                 return "seminar";
  if (/복음세미나|q&a|qna/.test(tit))                                    return "seminar";

  // Fall back to context only when title gives no clue
  const ctx = context.toLowerCase();
  if (/총무\s*미팅|전체\s*총무|정기\s*모임/.test(ctx))                   return "meeting";
  if (/세미나/.test(ctx) && !/예배/.test(ctx))                           return "seminar";
  if (/milk|밀크/.test(ctx))                                             return "seminar";

  return "worship";
}

// ── English service detection ──────────────────────────────────────────────

// A "bracket English title" looks like [The Something of Something]
const ENGLISH_BRACKET_RE = /^\[([A-Z][^가-힣]{4,})\]\s*$/;

function isEnglishBracket(line) {
  return ENGLISH_BRACKET_RE.test(line.trim());
}

function isEnglishContext(lines, idx) {
  // look at up to 6 lines before idx
  for (let j = Math.max(0, idx - 6); j < idx; j++) {
    const l = lines[j];
    if (/영어\s*예(배|비)|영어\s*서비스|english\s*(service|worship)|bosco/i.test(l)) return true;
  }
  return false;
}

// ── title extraction ──────────────────────────────────────────────────────────

// Same-line format: text before URL contains (something) → extract all (…) groups, join
function extractSameLineTitle(text) {
  // Remove the URL part first
  const withoutUrl = text.replace(/https?:\/\/\S+/g, "").trim();
  // Remove the [Name] [time] prefix
  const msgBody = withoutUrl.replace(/^\[.+?\]\s*\[.+?\]\s*/, "").trim();
  // Collect all (…) groups
  const parts = [];
  let m;
  const re = /\(([^)]+)\)/g;
  while ((m = re.exec(msgBody)) !== null) {
    parts.push(m[1].trim());
  }
  if (parts.length) return parts.join(" ");
  // If no parens, use whatever text is left (might be a plain message like a title)
  return msgBody.replace(/^[^\uAC00-\uD7A3A-Za-z0-9(（]*/, "").trim();
}

// ── parse ─────────────────────────────────────────────────────────────────────

const DATE_HDR  = /[-─━]{4,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
const YT_URL_RE = /https?:\/\/(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([A-Za-z0-9_-]{6,})(?:\?[^\s]*)*/g;

function parseChatFile(filePath) {
  const text  = fs.readFileSync(filePath, "utf-8");
  const lines = text.split("\n").map(l => l.replace(/\r$/, ""));

  const results = [];
  let currentDate = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── date header ──
    const dm = DATE_HDR.exec(line);
    if (dm) {
      currentDate = `${dm[1]}-${dm[2].padStart(2,"0")}-${dm[3].padStart(2,"0")}`;
      continue;
    }

    if (!currentDate) continue;

    // ── find YouTube URLs in this line ──
    YT_URL_RE.lastIndex = 0;
    let match;
    while ((match = YT_URL_RE.exec(line)) !== null) {
      const rawUrl   = match[0].split("?")[0]; // strip ?si= and other share params
      const ytId     = youtubeId(rawUrl);

      if (!ytId)                  continue;   // invalid id
      if (rawUrl.includes("/shorts/")) continue; // skip shorts

      // ── English service check ──
      // Case A: this URL is on its own (line is just the URL)
      if (line.trim().startsWith("http")) {
        if (isEnglishBracket(lines[i - 1] || "") || isEnglishContext(lines, i)) {
          continue; // English service – skip
        }
      }
      // Case B: same-line message containing `영어예배` or `영어예비`
      if (/영어\s*예(배|비)|english\s*(service|worship)/i.test(line)) {
        continue; // skip
      }
      // Case C: Bosco Baek + URL on same line
      if (/bosco/i.test(line)) continue;

      // ── extract title ──
      let title = "";
      if (line.trim().startsWith("http")) {
        // URL-only line: check prev line for a `(title)` message or plain Korean description
        const prev = (lines[i - 1] || "").trim();
        // Prev line might look like: "[Name] [time] (title)" - no URL
        const prevTitleMatch = prev.match(/\(([^)]+)\)\s*$/);
        if (prevTitleMatch) {
          title = prevTitleMatch[1].trim();
        } else {
          // Check if prev-prev line has the message prefix with title
          const prev2 = (lines[i - 2] || "").trim();
          const prev2TitleMatch = prev2.match(/^\[.+?\]\s*\[.+?\]\s*(.*)/);
          if (prev2TitleMatch) {
            const body = prev2TitleMatch[1];
            const inParen = body.match(/\(([^)]+)\)/);
            if (inParen) title = inParen[1].trim();
          }
        }
      } else {
        // Same-line: strip the full original URL match (including ?si= etc.) before extracting title
        const lineNoUrl = line.replace(match[0], "").replace(/\?si=[A-Za-z0-9_-]+/g, "").trim();
        title = extractSameLineTitle(lineNoUrl);
      }

      const category = classifyCategory(title, lines.slice(Math.max(0, i-4), i+1).join(" "));

      results.push({ url: rawUrl, date: currentDate, title, category });
    }
  }
  return results;
}

// ── deduplicate ────────────────────────────────────────────────────────────

function dedup(entries) {
  const seen = new Map();
  for (const e of entries) {
    const id = youtubeId(e.url);
    if (!id) continue;
    if (!seen.has(id)) seen.set(id, e);
  }
  return [...seen.values()];
}

// ── main ──────────────────────────────────────────────────────────────────────

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error("DB not found:", DB_PATH, "— start the Next.js app first.");
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Ensure category column
  const cols = db.prepare("PRAGMA table_info(links)").all().map(c => c.name);
  if (!cols.includes("category")) {
    db.exec("ALTER TABLE links ADD COLUMN category TEXT DEFAULT ''");
  }

  // Delete previous kakao imports so we can re-seed cleanly
  const deleted = db.prepare("DELETE FROM links WHERE source='kakao'").run();
  console.log(`이전 카카오 임포트 ${deleted.changes}개 삭제`);

  // Existing YouTube IDs (from seed entries)
  const seedRows = db.prepare("SELECT share_url, archive_url FROM links WHERE source='seed'").all();
  const existingIds = new Set();
  for (const r of seedRows) {
    const id1 = youtubeId(r.share_url || "");
    const id2 = youtubeId(r.archive_url || "");
    if (id1) existingIds.add(id1);
    if (id2) existingIds.add(id2);
  }
  console.log(`시드 YouTube ID: ${existingIds.size}개`);

  // Parse
  console.log("채팅 파싱 중...");
  const raw    = parseChatFile(CHAT_PATH);
  console.log(`URL 수집: ${raw.length}개`);
  const unique = dedup(raw);
  console.log(`중복 제거: ${unique.length}개`);

  const toInsert = unique.filter(e => !existingIds.has(youtubeId(e.url)));
  console.log(`신규 삽입 대상: ${toInsert.length}개`);

  // Category stats
  const cats = {};
  for (const e of toInsert) cats[e.category] = (cats[e.category] || 0) + 1;
  console.log("카테고리:", JSON.stringify(cats));

  // Preview first 15
  console.log("\n--- 샘플 (앞 15개) ---");
  toInsert.slice(0, 15).forEach(e =>
    console.log(e.date, e.category.padEnd(8), JSON.stringify(e.title), e.url.slice(0,40))
  );

  if (DRY_RUN) { console.log("\n[dry-run] 삽입 안 함"); db.close(); return; }

  const insert = db.prepare(`
    INSERT INTO links (id, title, share_url, archive_url, date, thumb, note, source, category, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'kakao', ?, ?)
  `);
  const insertMany = db.transaction(() => {
    for (const e of toInsert) {
      insert.run(uid(), e.title || "", e.url, "", e.date, youtubeThumb(e.url), "", e.category, Date.now());
    }
  });
  insertMany();

  const total = db.prepare("SELECT COUNT(*) as c FROM links").get().c;
  console.log(`\n완료! 전체 링크 수: ${total}개`);
  db.close();
}

run();
