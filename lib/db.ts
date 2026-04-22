import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "firstfruits.sqlite");

let db: Database.Database | null = null;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseKoreanDate(v: string): string {
  const m = v.match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

const SEED_ROWS = [
  { title: "열정은 어디에서 오는가", archive: "https://youtu.be/xDRW4gvB_AY", shareUrl: "https://youtu.be/XcHXAKevshs", date: "2026년 01월 04일" },
  { title: "건강의 10원칙", archive: "https://youtu.be/jKHcephBwYA", shareUrl: "https://youtu.be/KDjWo6MvQUM", date: "2026년 01월 07일" },
  { title: "좋은 조직 문화 만들기(교제의 원칙)", archive: "https://youtu.be/Rtyja3FIPnI", shareUrl: "https://youtu.be/Vc0XtFA1YEw", date: "2026년 01월 11일" },
  { title: "천주교 vs 개신교(어느 쪽이 맞나요?)", archive: "https://youtu.be/_iwKD_fRBCU", shareUrl: "https://youtu.be/1-Q6Pjz9QOA", date: "2026년 01월 14일" },
  { title: "자유로운 신앙생활 vs 숨 막히는 신앙생활", archive: "https://youtu.be/Dk_YYyv_UuE", shareUrl: "https://youtu.be/yqt2-U0yhNs", date: "2026년 01월 18일" },
  { title: "AI의 미래와 성경적 신호", archive: "https://youtu.be/3owvYKIFR_c", shareUrl: "https://youtu.be/knD-3qX5Lis", date: "2026년 01월 21일" },
  { title: "YouTube 영상 idVjfo", archive: "https://youtu.be/QI8hCayijDo", shareUrl: "https://youtu.be/idVjfo_e_DA", date: "2026년 01월 24일" },
  { title: "생각보다 늦게 오는 상과 벌", archive: "https://youtu.be/pLt7-dtCBBg", shareUrl: "https://youtu.be/rPEvDr7xTGU", date: "2026년 01월 25일" },
  { title: "욕구와 의도", archive: "https://youtu.be/tFVXGKpD5-Q", shareUrl: "https://youtu.be/3zSbBL1rA_8", date: "2026년 01월 28일" },
  { title: "하나님이 감사하라고 하시는 이유", archive: "https://youtu.be/hYlsc8IQSVk", shareUrl: "https://youtu.be/5nMFYLUvr84", date: "2026년 02월 01일" },
  { title: "진짜 하나님을 위해서 맞아요", archive: "https://youtu.be/k5Owii8nvxE", shareUrl: "https://youtu.be/toDy2YEksFY", date: "2026년 02월 04일" },
  { title: "교회를 산모에 비유한 이유(+허태림님 간증)", archive: "https://youtu.be/r8aE6GCSeFw", shareUrl: "https://youtu.be/x_Lp-BzGjsw", date: "2026년 02월 08일" },
  { title: "첫열매들 교회의 교리가 뭐가 다른가요?", archive: "https://youtu.be/vZnXtiupLTM", shareUrl: "https://youtu.be/g9XE68tm5Ic", date: "2026년 02월 11일" },
  { title: "260215 사탄의 일꾼(+정승현님 간증)", archive: "https://youtu.be/97pRtNDRcNQ", shareUrl: "https://www.youtube.com/watch?v=C3y7IpzCp8o", date: "2026년 02월 15일" },
  { title: "260218 사탄 정확히 알기", archive: "https://youtu.be/5nfPEchUFFM", shareUrl: "https://www.youtube.com/watch?v=Ixce51kkc58", date: "2026년 02월 18일" },
  { title: "260222 버리지 못하는 한 가지가 당신을 망칩니다", archive: "https://youtu.be/UjyRKKoJ_rY", shareUrl: "https://www.youtube.com/watch?v=3oTI7pkKd0g", date: "2026년 02월 22일" },
  { title: "260225 깨달음의 눈", archive: "https://youtu.be/4BWfisTCz4U", shareUrl: "https://youtu.be/wyZafQd_Oag", date: "2026년 02월 25일" },
  { title: "260302 하나님은 왜 비극적인 일들을 허락하실까?", archive: "https://youtu.be/iX2MMKu7ASs", shareUrl: "https://youtu.be/ZWC_YjPAPbM", date: "2026년 03월 01일" },
  { title: "(Unknown)", archive: "", shareUrl: "", date: "2026년 03월 04일" },
  { title: "260308 선물로 받는 믿음의 증인들(+유한종님 간증)", archive: "https://youtu.be/2If5gAfR-sM", shareUrl: "https://www.youtube.com/watch?v=0l2BuXCH3ss", date: "2026년 03월 08일" },
  { title: "260311 욥기 잘못 알고 계십니다", archive: "https://youtu.be/-2I69kOqfuc", shareUrl: "https://youtu.be/hn_oxGu3REU", date: "2026년 03월 11일" },
  { title: "260315 지식의 단계적 계시(+김성관님 간증)", archive: "https://youtu.be/WXci5aHePGA", shareUrl: "https://youtu.be/QJ8-I86rZeI", date: "2026년 03월 15일" },
  { title: "AI를 이용한 검증 (pdf 파일)", archive: "", shareUrl: "", date: "2026년 03월 18일" },
  { title: "260322 밀크시리즈 변경사항", archive: "https://youtu.be/OZTl-LypfoI", shareUrl: "https://youtu.be/S2lbkAiXllQ", date: "2026년 03월 22일" },
  { title: "260325 조금씩 성장하고 있으면 된겁니다", archive: "https://youtu.be/A4lrwdpNqiM", shareUrl: "https://youtu.be/WpX2Q7XTO5k", date: "2026년 03월 25일" },
  { title: "260329 상반기 복음세미나", archive: "", shareUrl: "https://youtu.be/8GZcyEk59Vk", date: "2026년 03월 29일" },
  { title: "260329 상반기 복음세미나 Q&A", archive: "", shareUrl: "https://youtu.be/EH--Ew6Km-Q", date: "2026년 03월 29일" },
  { title: "2026년 MILK1. 천국에 가는지 확인해보세요!", archive: "", shareUrl: "https://youtu.be/kX4pnUrEUdw", date: "2026년 04월 01일" },
  { title: "2026년 MILK2. 인간의 영/혼/몸(몸을 주신 이유)", archive: "", shareUrl: "https://youtu.be/0kQCixrlRrs", date: "2026년 04월 05일" },
  { title: "2026년 MILK3-1. 예수-피가 있는 하나님", archive: "", shareUrl: "https://youtu.be/pGMZMMLR-iY", date: "2026년 04월 08일" },
  { title: "2026년 MILK3-2 예수-피가 있는 하나님", archive: "", shareUrl: "https://youtu.be/RvkHqQuPX40", date: "2026년 04월 12일" },
];

function youtubeId(url: string): string {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (h.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch")) return u.searchParams.get("v") || "";
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || "";
    }
    return "";
  } catch { return ""; }
}

function youtubeThumb(url: string): string {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
}

function seedIfEmpty(database: Database.Database) {
  const row = database.prepare("SELECT COUNT(*) as count FROM links").get() as { count: number };
  if (row.count > 0) return;

  const insert = database.prepare(`
    INSERT INTO links (id, title, share_url, archive_url, date, thumb, note, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction(() => {
    for (const row of SEED_ROWS) {
      const date = parseKoreanDate(row.date);
      const thumb = youtubeThumb(row.shareUrl) || youtubeThumb(row.archive);
      insert.run(uid(), row.title, row.shareUrl, row.archive, date, thumb, "", "seed", Date.now());
    }
  });
  insertMany();
}

function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      share_url TEXT DEFAULT '',
      archive_url TEXT DEFAULT '',
      date TEXT NOT NULL,
      thumb TEXT DEFAULT '',
      note TEXT DEFAULT '',
      source TEXT DEFAULT 'local',
      created_at INTEGER NOT NULL
    );
  `);

  // migration: add category if missing
  const cols = (db.prepare("PRAGMA table_info(links)").all() as { name: string }[]).map(c => c.name);
  if (!cols.includes("category")) {
    db.exec("ALTER TABLE links ADD COLUMN category TEXT DEFAULT ''");
  }

  seedIfEmpty(db);
  return db;
}

export type Link = {
  id: string;
  title: string;
  shareUrl: string;
  archiveUrl: string;
  date: string;
  thumb: string;
  note: string;
  source: string;
  category: string;
  createdAt: number;
};

function toLink(row: Record<string, unknown>): Link {
  return {
    id: row.id as string,
    title: row.title as string,
    shareUrl: (row.share_url as string) || "",
    archiveUrl: (row.archive_url as string) || "",
    date: row.date as string,
    thumb: (row.thumb as string) || "",
    note: (row.note as string) || "",
    source: (row.source as string) || "local",
    category: (row.category as string) || "",
    createdAt: row.created_at as number,
  };
}

export function getAllLinks(): Link[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM links ORDER BY date DESC, title ASC
  `).all() as Record<string, unknown>[];
  return rows.map(toLink);
}

export function createLink(input: {
  title: string;
  shareUrl: string;
  archiveUrl: string;
  date: string;
  thumb: string;
  note: string;
  category?: string;
}): Link {
  const database = getDb();
  const id = uid();
  const thumb = input.thumb || youtubeThumb(input.shareUrl) || youtubeThumb(input.archiveUrl);
  database.prepare(`
    INSERT INTO links (id, title, share_url, archive_url, date, thumb, note, source, category, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'local', ?, ?)
  `).run(id, input.title, input.shareUrl, input.archiveUrl, input.date, thumb, input.note, input.category ?? "", Date.now());

  return toLink(
    database.prepare("SELECT * FROM links WHERE id = ?").get(id) as Record<string, unknown>
  );
}

export function deleteLink(id: string) {
  const database = getDb();
  database.prepare("DELETE FROM links WHERE id = ?").run(id);
}

export function updateLink(id: string, input: {
  title?: string;
  shareUrl?: string;
  archiveUrl?: string;
  date?: string;
  thumb?: string;
  note?: string;
  category?: string;
}) {
  const database = getDb();
  const current = database.prepare("SELECT * FROM links WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!current) throw new Error("링크를 찾을 수 없습니다.");

  const shareUrl = input.shareUrl ?? (current.share_url as string);
  const archiveUrl = input.archiveUrl ?? (current.archive_url as string);
  const thumb = input.thumb !== undefined
    ? input.thumb
    : (youtubeThumb(shareUrl) || youtubeThumb(archiveUrl) || (current.thumb as string));

  database.prepare(`
    UPDATE links SET title = ?, share_url = ?, archive_url = ?, date = ?, thumb = ?, note = ?, category = ? WHERE id = ?
  `).run(
    input.title ?? current.title,
    shareUrl,
    archiveUrl,
    input.date ?? current.date,
    thumb,
    input.note ?? current.note,
    input.category ?? (current.category as string) ?? "",
    id
  );
}
