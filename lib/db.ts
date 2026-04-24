import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Vercel Lambda filesystem is read-only at process.cwd(); use /tmp for writable storage.
const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "firstfruits.sqlite")
  : path.join(process.cwd(), "data", "firstfruits.sqlite");

let db: Database.Database | null = null;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseKoreanDate(v: string): string {
  const m = v.match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

const SEED_ROWS = [
  // ── 2022 ───────────────────────────────────────────────────────────────────
  { title: "Bad Vegan: Fame. Fraud. Fugitives. — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=4nTf7iViYUI", archive: "https://www.youtube.com/watch?v=4nTf7iViYUI", date: "2022-03-16", category: "" },
  { title: "Return to Space — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=sIME4sLR4-8", archive: "https://www.youtube.com/watch?v=sIME4sLR4-8", date: "2022-04-07", category: "" },
  { title: "Navalny — Official Trailer (2022)", shareUrl: "https://www.youtube.com/watch?v=ZF_HsKCWEHw", archive: "https://www.youtube.com/watch?v=ZF_HsKCWEHw", date: "2022-04-24", category: "" },
  { title: "Fire of Love — Official Trailer (National Geographic)", shareUrl: "https://www.youtube.com/watch?v=pH6Fn_RA21M", archive: "https://www.youtube.com/watch?v=pH6Fn_RA21M", date: "2022-07-06", category: "" },
  { title: "All That Breathes — Official Trailer (HBO)", shareUrl: "https://www.youtube.com/watch?v=GoTlULspDyY", archive: "https://www.youtube.com/watch?v=GoTlULspDyY", date: "2022-07-22", category: "" },
  // ── 2021 ───────────────────────────────────────────────────────────────────
  { title: "Seaspiracy — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=1Q5CXN7soQg", archive: "https://www.youtube.com/watch?v=1Q5CXN7soQg", date: "2021-03-24", category: "" },
  { title: "Summer of Soul — Official Trailer (2021)", shareUrl: "https://www.youtube.com/watch?v=1-siC9cugqA", archive: "https://www.youtube.com/watch?v=1-siC9cugqA", date: "2021-07-02", category: "" },
  { title: "Roadrunner: A Film About Anthony Bourdain — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=qbgKJPDo0tU", archive: "https://www.youtube.com/watch?v=qbgKJPDo0tU", date: "2021-07-16", category: "" },
  { title: "Val — Official Trailer (Prime Video)", shareUrl: "https://www.youtube.com/watch?v=YqNnhgEyQCU", archive: "https://www.youtube.com/watch?v=YqNnhgEyQCU", date: "2021-07-23", category: "" },
  { title: "Flee — Official Trailer (2021)", shareUrl: "https://www.youtube.com/watch?v=2gOdc1mgK-o", archive: "https://www.youtube.com/watch?v=2gOdc1mgK-o", date: "2021-12-03", category: "" },
  // ── 2020 ───────────────────────────────────────────────────────────────────
  { title: "Crip Camp: A Disability Revolution — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=XRrIs22plz0", archive: "https://www.youtube.com/watch?v=XRrIs22plz0", date: "2020-03-25", category: "" },
  { title: "The Last Dance — Official Trailer (Netflix/ESPN)", shareUrl: "https://www.youtube.com/watch?v=U2uAYhLIqL0", archive: "https://www.youtube.com/watch?v=U2uAYhLIqL0", date: "2020-04-19", category: "" },
  { title: "My Octopus Teacher — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=3s0LTDhqe5A", archive: "https://www.youtube.com/watch?v=3s0LTDhqe5A", date: "2020-09-07", category: "" },
  { title: "The Social Dilemma — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=uaaC57tcci0", archive: "https://www.youtube.com/watch?v=uaaC57tcci0", date: "2020-09-09", category: "" },
  { title: "Dick Johnson Is Dead — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=wfTmT6C5DnM", archive: "https://www.youtube.com/watch?v=wfTmT6C5DnM", date: "2020-10-02", category: "" },
  { title: "David Attenborough: A Life on Our Planet — Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=64R2MYUt394", archive: "https://www.youtube.com/watch?v=64R2MYUt394", date: "2020-10-04", category: "" },
  // ── 2019 ───────────────────────────────────────────────────────────────────
  { title: "Apollo 11 — Official Trailer (2019)", shareUrl: "https://www.youtube.com/watch?v=BJ9YbxqLfzY", archive: "https://www.youtube.com/watch?v=BJ9YbxqLfzY", date: "2019-03-08", category: "" },
  { title: "American Factory — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=m36QeKOJ2Fc", archive: "https://www.youtube.com/watch?v=m36QeKOJ2Fc", date: "2019-08-21", category: "" },
  { title: "For Sama — Official Trailer (PBS)", shareUrl: "https://www.youtube.com/watch?v=vsvBqtg2RM0", archive: "https://www.youtube.com/watch?v=vsvBqtg2RM0", date: "2019-11-07", category: "" },
  // ── 2018 ───────────────────────────────────────────────────────────────────
  { title: "RBG — Official Trailer (2018)", shareUrl: "https://www.youtube.com/watch?v=biIRlcQqmOc", archive: "https://www.youtube.com/watch?v=biIRlcQqmOc", date: "2018-05-04", category: "" },
  { title: "Won't You Be My Neighbor? — Official Trailer (2018)", shareUrl: "https://www.youtube.com/watch?v=FhwktRDG_aQ", archive: "https://www.youtube.com/watch?v=FhwktRDG_aQ", date: "2018-06-08", category: "" },
  { title: "Three Identical Strangers — Official Trailer (2018)", shareUrl: "https://www.youtube.com/watch?v=uM5TQ4f7ycw", archive: "https://www.youtube.com/watch?v=uM5TQ4f7ycw", date: "2018-06-29", category: "" },
  { title: "Free Solo — Official Trailer (National Geographic)", shareUrl: "https://www.youtube.com/watch?v=urRVZ4SW7WU", archive: "https://www.youtube.com/watch?v=urRVZ4SW7WU", date: "2018-09-28", category: "" },
  // ── 2017 ───────────────────────────────────────────────────────────────────
  { title: "I Am Not Your Negro — Official Trailer (2017)", shareUrl: "https://www.youtube.com/watch?v=5SnzrT7PWZ0", archive: "https://www.youtube.com/watch?v=5SnzrT7PWZ0", date: "2017-02-03", category: "" },
  { title: "Icarus — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=qXoRdSTrR-4", archive: "https://www.youtube.com/watch?v=qXoRdSTrR-4", date: "2017-08-04", category: "" },
  // ── 2016 ───────────────────────────────────────────────────────────────────
  { title: "13th — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=krfcq5pF8u8", archive: "https://www.youtube.com/watch?v=krfcq5pF8u8", date: "2016-10-07", category: "" },
  { title: "Planet Earth II — Official Trailer (BBC)", shareUrl: "https://www.youtube.com/watch?v=c8aFcHFu8QM", archive: "https://www.youtube.com/watch?v=c8aFcHFu8QM", date: "2016-11-06", category: "" },
  // ── 2014 ───────────────────────────────────────────────────────────────────
  { title: "Cosmos: A Spacetime Odyssey — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=Ln8UwPd1z20", archive: "https://www.youtube.com/watch?v=Ln8UwPd1z20", date: "2014-03-09", category: "" },
  { title: "Citizenfour — Official Trailer (2014)", shareUrl: "https://www.youtube.com/watch?v=XiGwAvd5mvM", archive: "https://www.youtube.com/watch?v=XiGwAvd5mvM", date: "2014-10-10", category: "" },
  // ── 2013 ───────────────────────────────────────────────────────────────────
  { title: "Blackfish — Official Trailer (2013)", shareUrl: "https://www.youtube.com/watch?v=G93beiYiE74", archive: "https://www.youtube.com/watch?v=G93beiYiE74", date: "2013-07-19", category: "" },
  // ── 2012 ───────────────────────────────────────────────────────────────────
  { title: "Jiro Dreams of Sushi — Official Trailer (2012)", shareUrl: "https://www.youtube.com/watch?v=M-aGPniFvS0", archive: "https://www.youtube.com/watch?v=M-aGPniFvS0", date: "2012-03-09", category: "" },
  // ── 2011 ───────────────────────────────────────────────────────────────────
  { title: "Senna — Official Trailer (2011)", shareUrl: "https://www.youtube.com/watch?v=sfosF-ZAbR4", archive: "https://www.youtube.com/watch?v=sfosF-ZAbR4", date: "2011-06-03", category: "" },
  // ── 2010 ───────────────────────────────────────────────────────────────────
  { title: "Exit Through the Gift Shop — Official Trailer (Banksy)", shareUrl: "https://www.youtube.com/watch?v=oHJBdDSTbLw", archive: "https://www.youtube.com/watch?v=oHJBdDSTbLw", date: "2010-04-16", category: "" },
  // ── 2005 ───────────────────────────────────────────────────────────────────
  { title: "Grizzly Man — Official Trailer (Werner Herzog)", shareUrl: "https://www.youtube.com/watch?v=uWA7GtDmNFU", archive: "https://www.youtube.com/watch?v=uWA7GtDmNFU", date: "2005-08-12", category: "" },
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
      const date = parseKoreanDate(row.date) || row.date;
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
