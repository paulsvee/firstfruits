"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Link } from "@/lib/db";

// ── helpers ──────────────────────────────────────────────────────────────────

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

function isUrl(v: string): boolean {
  try { new URL(v); return true; } catch { return false; }
}

function domainOf(link: Link): string {
  const url = link.shareUrl || link.archiveUrl;
  if (!isUrl(url)) return "직접 기록";
  return new URL(url).hostname.replace(/^www\./, "");
}

function typeOf(link: Link): "both" | "archive" | "share" | "manual" {
  if (link.shareUrl && link.archiveUrl) return "both";
  if (link.archiveUrl) return "archive";
  if (link.shareUrl) return "share";
  return "manual";
}

const CAT_LABEL: Record<string, string> = { worship: "예배", milk: "MILK", seminar: "세미나", meeting: "모임", other: "기타" };

const CAT_OPTIONS: [string, string][] = [
  ["", "미분류"],
  ["worship", "예배"],
  ["milk", "MILK"],
  ["seminar", "세미나"],
  ["meeting", "모임"],
  ["other", "기타"],
];

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="cat-select">
      {CAT_OPTIONS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`cat-sel-chip${value === key ? " active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function typeLabel(t: string): string {
  if (t === "both") return "shared + archive";
  if (t === "archive") return "archive only";
  if (t === "share") return "shared link";
  return "manual";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayOfWeek(date: string): string {
  if (!date) return "";
  return WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
}

function formatDate(v: string): string {
  if (!v) return "날짜 없음";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${v}T00:00:00`));
}

function formatYear(v: string): string {
  return `${v}년`;
}

function groupByYear(links: Link[]): Record<string, Link[]> {
  return links.reduce<Record<string, Link[]>>((acc, link) => {
    const key = link.date.slice(0, 4);
    (acc[key] ||= []).push(link);
    return acc;
  }, {});
}

async function fetchMeta(url: string) {
  const yt = youtubeThumb(url);
  const fallback = { title: "", thumb: yt, description: "" };

  // 1) YouTube 공식 oEmbed — 가장 빠르고 정확
  const ytId = youtubeId(url);
  if (ytId) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || fallback.title,
          thumb: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          description: data.author_name || "",
        };
      }
    } catch { /* fall through */ }
  }

  // 2) noembed fallback
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.title) return { title: data.title, thumb: data.thumbnail_url || yt || "", description: data.author_name || "" };
    }
  } catch { /* fall through */ }

  // 3) microlink fallback
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&meta=false`);
    if (res.ok) {
      const data = await res.json();
      const d = data.data || {};
      if (d.title) return { title: d.title, thumb: d.image?.url || yt || "", description: d.description || "" };
    }
  } catch { /* fall through */ }

  return fallback;
}

// ── Thumb ─────────────────────────────────────────────────────────────────────

function Thumb({ link }: { link: Link }) {
  const domain = domainOf(link);
  if (!link.thumb) return <div className="thumb-fallback">{domain}</div>;
  return (
    <img
      className="media"
      src={link.thumb}
      alt={link.title}
      loading="lazy"
      onError={(e) => { (e.currentTarget as HTMLImageElement).outerHTML = `<div class="thumb-fallback">${domain}</div>`; }}
    />
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({
  link,
  onOpen,
  onDeleteRequest,
  onEditRequest,
}: {
  link: Link;
  onOpen: () => void;
  onDeleteRequest: () => void;
  onEditRequest: () => void;
}) {
  const t = typeOf(link);

  return (
    <article className="card" onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) onOpen(); }}>
      <div className="overlay">
        <Thumb link={link} />
        <div className="overlay-info" style={{ justifyContent: "space-between" }}>
          {link.category && CAT_LABEL[link.category]
            ? <span className="day cat-badge">{CAT_LABEL[link.category]}</span>
            : <span />}
          <span className="day">{link.date.slice(5).replace("-", ".")} <span style={{ opacity: 0.55 }}>{dayOfWeek(link.date)}</span></span>
        </div>
      </div>
      <div className="card-body">
        <h4>{link.title}</h4>
        <div className="links" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {link.shareUrl && <a className="link-btn" href={link.shareUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>공유 링크</a>}
            {link.archiveUrl && <a className="link-btn primary" href={link.archiveUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>아카이브</a>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="link-btn"
              style={{ color: "rgba(255,255,255,0.7)" }}
              onClick={e => { e.stopPropagation(); onEditRequest(); }}
              title="수정"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              className="link-btn"
              style={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.08)" }}
              onClick={e => { e.stopPropagation(); onDeleteRequest(); }}
              title="삭제"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ link, onSave, onCancel }: {
  link: Link;
  onSave: (updated: Link) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(link.title);
  const [shareUrl, setShareUrl] = useState(link.shareUrl);
  const [archiveUrl, setArchiveUrl] = useState(link.archiveUrl);
  const [date, setDate] = useState(link.date);
  const [thumb, setThumb] = useState(link.thumb);
  const [note, setNote] = useState(link.note);
  const [cat, setCat] = useState(link.category || "");
  const [status, setStatus] = useState<{ msg: string; tone: string }>({ msg: "", tone: "" });
  const [fetching, setFetching] = useState(false);

  async function hydrateThumb() {
    const url = shareUrl.trim() || archiveUrl.trim();
    if (!url) return;
    setFetching(true);
    setStatus({ msg: "메타데이터를 가져오는 중...", tone: "" });
    try {
      const meta = await fetchMeta(url);
      if (meta.title && !title.trim()) setTitle(meta.title);
      if (meta.thumb) setThumb(meta.thumb);
      setStatus({ msg: "반영됐습니다.", tone: "success" });
    } catch {
      setStatus({ msg: "가져오지 못했습니다.", tone: "error" });
    } finally { setFetching(false); }
  }

  async function handleSave() {
    const res = await fetch(`/api/links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), shareUrl: shareUrl.trim(), archiveUrl: archiveUrl.trim(), date, thumb: thumb.trim(), note: note.trim(), category: cat }),
    });
    if (!res.ok) { setStatus({ msg: "저장 실패", tone: "error" }); return; }
    const updated: Link = await res.json();
    onSave(updated);
  }

  const previewThumb = thumb || youtubeThumb(shareUrl) || youtubeThumb(archiveUrl);

  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sheet" style={{ width: "min(1100px, 96vw)", maxHeight: "92vh", overflowY: "auto" }}>
        <div className="sheet-head">
          <div>
            <h2>링크 수정</h2>
          </div>
          <button className="xbtn" onClick={onCancel}>×</button>
        </div>

        {/* 외부: 왼쪽(2/3) + 오른쪽 Preview(1/3) */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0 }}>

          {/* 왼쪽 2/3: 상단 2열 + 하단 전폭(카테고리·메모) */}
          <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)" }}>

            {/* 상단: 제목/날짜 | 공유링크/아카이브링크 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--line)" }}>
              <div className="pane" style={{ borderRight: "1px solid var(--line)" }}>
                <div className="field"><label>제목</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} /></div>
                <div className="field"><label>날짜</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                {status.msg && <div className={`status show${status.tone ? ` ${status.tone}` : ""}`}>{status.msg}</div>}
              </div>
              <div className="pane">
                <div className="field"><label>공유 링크 URL</label><input type="url" value={shareUrl} onChange={e => setShareUrl(e.target.value)} /></div>
                <div className="field"><label>아카이브 링크 URL</label><input type="url" value={archiveUrl} onChange={e => setArchiveUrl(e.target.value)} /></div>
              </div>
            </div>

            {/* 하단: 카테고리 + 메모 전폭 */}
            <div className="pane" style={{ flex: 1 }}>
              <div className="field"><label>카테고리</label><CategorySelect value={cat} onChange={setCat} /></div>
              <div className="field"><label>메모</label><textarea style={{ minHeight: 90, width: "100%", flex: 1 }} value={note} onChange={e => setNote(e.target.value)} /></div>
            </div>
          </div>

          {/* 오른쪽 1/3: 미리보기 + 썸네일 */}
          <div className="side" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="label">Preview</div>
            <div className="preview">
              {previewThumb ? <img className="media" src={previewThumb} alt="preview" /> : <div className="thumb-fallback">Preview</div>}
              <div className="preview-body">
                <h3>{title || "제목 없음"}</h3>
                <p>{date}</p>
              </div>
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>썸네일 URL</label>
              <input type="url" value={thumb} onChange={e => setThumb(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="sheet-actions">
          <button className="link-btn" onClick={hydrateThumb} disabled={fetching}>{fetching ? "가져오는 중..." : "메타 다시 가져오기"}</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="link-btn" onClick={onCancel}>취소</button>
            <button className="link-btn primary" onClick={handleSave}>저장하기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ link, onConfirm, onCancel }: { link: Link; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sheet" style={{ maxWidth: 480 }}>
        <div className="sheet-head">
          <div>
            <h2 style={{ fontSize: 22 }}>링크 삭제</h2>
            <p>아래 링크를 삭제하시겠습니까?<br /><strong style={{ color: "var(--text)" }}>{link.title}</strong></p>
          </div>
          <button className="xbtn" onClick={onCancel}>×</button>
        </div>
        <div className="sheet-actions" style={{ borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 10, padding: "18px 24px" }}>
          <button className="link-btn" onClick={onCancel}>취소</button>
          <button
            className="link-btn"
            style={{ background: "rgba(255,139,139,0.12)", borderColor: "rgba(255,139,139,0.28)", color: "var(--danger)" }}
            onClick={onConfirm}
          >삭제하기</button>
        </div>
      </div>
    </div>
  );
}

// ── LinkArchive ───────────────────────────────────────────────────────────────

const CATEGORY_TABS: [string, string][] = [
  ["all", "전체"],
  ["worship", "예배"],
  ["milk", "MILK"],
  ["seminar", "세미나"],
  ["meeting", "모임"],
  ["other", "기타"],
];

export default function LinkArchive({ initialLinks }: { initialLinks: Link[] }) {
  const [links, setLinks] = useState<Link[]>(initialLinks);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState("all");
  const [category, setCategory] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailLink, setDetailLink] = useState<Link | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Link | null>(null);
  const [editTarget, setEditTarget] = useState<Link | null>(null);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // quick-add state
  const [quickUrl, setQuickUrl] = useState("");
  const [quickStatus, setQuickStatus] = useState<"idle" | "fetching" | "saving" | "done">("idle");
  const quickTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // form state
  const [shareUrl, setShareUrl] = useState("");
  const [archiveUrl, setArchiveUrl] = useState("");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryThumb, setEntryThumb] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [entryCategory, setEntryCategory] = useState("");
  const [fetchStatus, setFetchStatus] = useState<{ msg: string; tone: string }>({ msg: "", tone: "" });
  const [fetching, setFetching] = useState(false);
  const metaTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function quickAdd(url: string) {
    if (!isUrl(url)) return;
    setQuickStatus("fetching");
    try {
      const meta = await fetchMeta(url);
      setQuickStatus("saving");
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.title || "",
          shareUrl: url,
          archiveUrl: "",
          date: today,
          thumb: meta.thumb || "",
          note: meta.description || "",
          category: "",
        }),
      });
      if (!res.ok) throw new Error();
      const newLink: Link = await res.json();
      setLinks(prev => [newLink, ...prev].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ko")));
      setQuickUrl("");
      setQuickStatus("idle");
      showToast(`"${meta.title || url}" 추가됐습니다.`);
    } catch {
      setQuickStatus("idle");
      showToast("저장에 실패했습니다.");
    }
  }

  function onQuickUrlChange(val: string) {
    setQuickUrl(val);
    setQuickStatus("idle");
    clearTimeout(quickTimer.current);
    if (isUrl(val)) {
      quickTimer.current = setTimeout(() => quickAdd(val), 600);
    }
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg); setToastVisible(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2400);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setModalOpen(false); setDetailLink(null); setDeleteTarget(null); setEditTarget(null); }
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); openModal(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── filter ──
  const filtered = links.filter((link) => {
    const q = search.trim().toLowerCase();
    const hay = [link.title, link.note, domainOf(link), link.shareUrl, link.archiveUrl].join(" ").toLowerCase();
    const m = link.date.slice(0, 4);
    const matchSearch = !q || hay.includes(q);
    const matchFilter =
      filter === "all" ||
      (filter === "both" && typeOf(link) === "both") ||
      (filter === "share" && !!link.shareUrl) ||
      (filter === "archive" && !!link.archiveUrl) ||
      (filter === "local" && link.source === "local") ||
      (filter === "missing-thumb" && !link.thumb);
    const matchMonth = month === "all" || month === m;
    const matchCategory =
      category === "all" ||
      (category === "other"
        ? (!link.category || link.category === "other")
        : link.category === category);
    return matchSearch && matchFilter && matchMonth && matchCategory;
  }).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ko"));

  const months = Array.from(new Set(links.map(l => l.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  const filterItems: [string, string, number][] = [
    ["all", "전체 링크", links.length],
    ["both", "공유 + 아카이브", links.filter(l => typeOf(l) === "both").length],
    ["share", "공유 링크 있음", links.filter(l => !!l.shareUrl).length],
    ["archive", "아카이브 있음", links.filter(l => !!l.archiveUrl).length],
    ["local", "직접 추가한 항목", links.filter(l => l.source === "local").length],
    ["missing-thumb", "썸네일 없는 항목", links.filter(l => !l.thumb).length],
  ];
  const latest = filtered[0] || links[0];

  // ── form ──
  function openModal() {
    setShareUrl(""); setArchiveUrl(""); setEntryTitle("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryThumb(""); setEntryNote(""); setEntryCategory("");
    setFetchStatus({ msg: "", tone: "" });
    setModalOpen(true);
  }

  async function hydrateMeta(overrideUrl?: string) {
    const url = overrideUrl || shareUrl.trim() || archiveUrl.trim();
    if (!url) { setFetchStatus({ msg: "먼저 공유 링크나 아카이브 링크를 입력해 주세요.", tone: "error" }); return; }
    setFetchStatus({ msg: "제목과 썸네일을 가져오는 중입니다...", tone: "" });
    setFetching(true);
    try {
      const meta = await fetchMeta(url);
      if (meta.title) setEntryTitle(prev => prev.trim() ? prev : meta.title);
      if (meta.thumb) setEntryThumb(prev => prev.trim() ? prev : meta.thumb);
      if (meta.description) setEntryNote(prev => prev.trim() ? prev : meta.description);
      setFetchStatus({ msg: "메타데이터를 반영했습니다.", tone: "success" });
    } catch {
      setFetchStatus({ msg: "메타데이터를 가져오지 못했습니다.", tone: "error" });
    } finally { setFetching(false); }
  }

  function onUrlChange(val: string, type: "share" | "archive") {
    if (type === "share") setShareUrl(val); else setArchiveUrl(val);
    clearTimeout(metaTimer.current);
    if (!isUrl(val)) return;
    // immediate YouTube thumb
    const yt = youtubeThumb(val);
    if (yt) setEntryThumb(prev => prev.trim() ? prev : yt);
    // debounced full meta (gets title from noembed/microlink)
    metaTimer.current = setTimeout(() => hydrateMeta(val), 800);
  }

  async function saveEntry() {
    const su = shareUrl.trim(); const au = archiveUrl.trim();
    if (!su && !au) { setFetchStatus({ msg: "공유 링크나 아카이브 링크 중 하나는 필요합니다.", tone: "error" }); return; }
    if (!entryDate) { setFetchStatus({ msg: "날짜를 입력해 주세요.", tone: "error" }); return; }
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: entryTitle.trim(), shareUrl: su, archiveUrl: au, date: entryDate, thumb: entryThumb.trim(), note: entryNote.trim(), category: entryCategory }),
    });
    if (!res.ok) { const err = await res.json(); setFetchStatus({ msg: err.error || "저장 실패", tone: "error" }); return; }
    const newLink: Link = await res.json();
    setLinks(prev => [newLink, ...prev].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ko")));
    setModalOpen(false);
    showToast("새 링크가 추가되었습니다.");
  }

  // ── delete ──
  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/links/${deleteTarget.id}`, { method: "DELETE" });
    setLinks(prev => prev.filter(l => l.id !== deleteTarget.id));
    setDeleteTarget(null);
    showToast("링크가 삭제되었습니다.");
  }

  // ── edit save ──
  function handleEditSaved(updated: Link) {
    setLinks(prev => prev.map(l => l.id === updated.id ? updated : l).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "ko")));
    setEditTarget(null);
    showToast("수정됐습니다.");
  }

  const previewThumb = entryThumb || youtubeThumb(shareUrl) || youtubeThumb(archiveUrl);
  const grouped = groupByYear(filtered);
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <div className="app">
        {/* topbar */}
        <header className="topbar">
          <div className="brand">
            <div className="kicker">FirstFruits Archive</div>
            <div className="title">Link <span>Harvest</span></div>
          </div>
          <div className="search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input type="search" placeholder="제목, 도메인, 메모로 찾기" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className={`quick-add${quickUrl ? " active" : ""}${quickStatus === "saving" ? " saving" : ""}`}>
            {/* YouTube icon */}
            <svg className="qa-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.6 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.3.6 9.3.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/>
            </svg>
            <input
              type="url"
              placeholder="유튜브 링크 붙여넣기 → 바로 저장"
              value={quickUrl}
              onChange={e => onQuickUrlChange(e.target.value)}
              onPaste={e => {
                const pasted = e.clipboardData.getData("text");
                if (isUrl(pasted)) {
                  e.preventDefault();
                  onQuickUrlChange(pasted);
                }
              }}
            />
            {quickStatus === "fetching" && <span className="qa-status">메타 가져오는 중…</span>}
            {quickStatus === "saving" && <span className="qa-status">저장 중…</span>}
          </div>

        </header>

        <div className="layout">
          {/* sidebar */}
          <aside>
            <div className="box">
              <div className="label">Overview</div>
              <div className="count">{links.length}</div>
              <div className="note">SQLite 기반 링크 아카이브입니다.</div>
              <div className="stats">
                <div className="stat"><strong>{links.filter(l => l.shareUrl).length}</strong><span>공유 링크 있음</span></div>
                <div className="stat"><strong>{links.filter(l => l.archiveUrl).length}</strong><span>아카이브 있음</span></div>
                <div className="stat"><strong>{months.length}</strong><span>연도 단위 정리</span></div>
                <div className="stat"><strong>{links.filter(l => l.source === "local").length}</strong><span>직접 추가한 항목</span></div>
              </div>
            </div>

            <div className="box">
              <div className="label">Filters</div>
              <div className="filter-list">
                {filterItems.map(([key, label, count]) => (
                  <button key={key} className={`filter${filter === key ? " active" : ""}`} onClick={() => setFilter(key)}>
                    <span>{label}</span><span>{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="box">
              <div className="label">Years</div>
              <div className="month-list">
                <button className={`month${month === "all" ? " active" : ""}`} onClick={() => setMonth("all")}>
                  <span>전체 연도 보기</span><span>{links.length}</span>
                </button>
                {months.map(m => (
                  <button key={m} className={`month${month === m ? " active" : ""}`} onClick={() => setMonth(m)}>
                    <span>{formatYear(m)}</span><span>{groupByYear(links)[m]?.length ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* main */}
          <main className="main">
            {/* Category chip tabs */}
            <div className="cat-tabs">
              {CATEGORY_TABS.map(([key, label]) => {
                const count = key === "all"
                  ? links.length
                  : key === "other"
                    ? links.filter(l => !l.category || l.category === "other").length
                    : links.filter(l => l.category === key).length;

                return (
                  <button
                    key={key}
                    className={`cat-chip${category === key ? " active" : ""}`}
                    onClick={() => setCategory(key)}
                  >
                    {label}
                    <span className="cat-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <section>
              <div className="section-head">
                <div>
                  <h3>Archive Timeline</h3>
                  <p>{month === "all" ? "전체 연도" : formatYear(month)} 기준 {filtered.length}개를 최신 날짜 순으로 보여주고 있습니다.</p>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="empty show">
                  <h3>조건에 맞는 링크가 아직 없어요</h3>
                  <p>검색어나 필터를 바꾸거나 새 링크를 추가하면 최신 날짜 기준으로 바로 위에 쌓입니다.</p>
                </div>
              ) : (
                sortedMonths.map(m => (
                  <section key={m} className="month-section">
                    <div className="month-head">
                      <strong>{formatYear(m)}</strong>
                      <span>{grouped[m].length} items</span>
                    </div>
                    <div className="grid">
                      {grouped[m].map(link => (
                        <Card
                          key={link.id}
                          link={link}
                          onOpen={() => setDetailLink(link)}
                          onDeleteRequest={() => setDeleteTarget(link)}
                          onEditRequest={() => setEditTarget(link)}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </section>
          </main>
        </div>
      </div>

      {/* Add link modal */}
      <div className={`modal-bg${modalOpen ? " open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <div className="sheet" style={{ width: "min(1100px, 96vw)", maxHeight: "92vh", overflowY: "auto" }}>
          <div className="sheet-head">
            <div>
              <h2>링크 추가</h2>
              <p>URL 입력 시 YouTube 제목과 썸네일을 자동으로 가져옵니다.</p>
            </div>
            <button className="xbtn" onClick={() => setModalOpen(false)}>×</button>
          </div>

          {/* 외부: 왼쪽(2/3) + 오른쪽 Preview(1/3) */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 0 }}>

            {/* 왼쪽 2/3: 상단 2열 + 하단 전폭(카테고리·메모) */}
            <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--line)" }}>

              {/* 상단: 제목/날짜 | 공유링크/아카이브링크 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--line)" }}>
                <div className="pane" style={{ borderRight: "1px solid var(--line)" }}>
                  <div className="field">
                    <label>제목</label>
                    <input type="text" placeholder="URL 입력 시 자동으로 채워집니다" value={entryTitle} onChange={e => setEntryTitle(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>날짜</label>
                    <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
                  </div>
                  {fetchStatus.msg && (
                    <div className={`status show${fetchStatus.tone ? ` ${fetchStatus.tone}` : ""}`}>{fetchStatus.msg}</div>
                  )}
                </div>
                <div className="pane">
                  <div className="field">
                    <label>공유 링크 URL</label>
                    <input type="url" placeholder="https://..." value={shareUrl} onChange={e => onUrlChange(e.target.value, "share")} />
                  </div>
                  <div className="field">
                    <label>아카이브 링크 URL</label>
                    <input type="url" placeholder="https://..." value={archiveUrl} onChange={e => onUrlChange(e.target.value, "archive")} />
                    <div className="hint">둘 중 하나만 있어도 저장됩니다.</div>
                  </div>
                </div>
              </div>

              {/* 하단: 카테고리 + 메모 전폭 */}
              <div className="pane" style={{ flex: 1 }}>
                <div className="field"><label>카테고리</label><CategorySelect value={entryCategory} onChange={setEntryCategory} /></div>
                <div className="field"><label>메모</label><textarea style={{ minHeight: 90, width: "100%" }} placeholder="예: 본편, Q&A, PDF 정리본" value={entryNote} onChange={e => setEntryNote(e.target.value)} /></div>
              </div>
            </div>

            {/* 오른쪽 1/3: 미리보기 + 썸네일 */}
            <div className="side" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="label">Live Preview</div>
              <div className="preview">
                {previewThumb
                  ? <img className="media" src={previewThumb} alt="preview" />
                  : <div className="thumb-fallback">Preview</div>}
                <div className="preview-body">
                  <div className="pills" style={{ marginTop: 0 }}>
                    {shareUrl && archiveUrl && <span className="badge type-both">shared + archive</span>}
                    {shareUrl && !archiveUrl && <span className="badge type-share">shared link</span>}
                    {!shareUrl && archiveUrl && <span className="badge type-archive">archive only</span>}
                  </div>
                  <h3>{entryTitle || "새 링크 카드 미리보기"}</h3>
                  <p>{entryDate ? formatDate(entryDate) : ""}</p>
                </div>
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label>썸네일 URL</label>
                <input type="url" placeholder="자동 추출 또는 직접 입력" value={entryThumb} onChange={e => setEntryThumb(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="sheet-actions">
            <button className="link-btn" onClick={() => hydrateMeta()} disabled={fetching}>
              {fetching ? "가져오는 중..." : "메타 다시 가져오기"}
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="link-btn" onClick={() => setModalOpen(false)}>취소</button>
              <button className="link-btn primary" onClick={saveEntry}>저장하기</button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detailLink && (
        <div className="detail-bg open" onClick={e => { if (e.target === e.currentTarget) setDetailLink(null); }}>
          <div className="sheet">
            <div className="sheet-head">
              <div>
                <h2>{detailLink.title}</h2>
                <p>공유 링크와 아카이브 링크를 함께 확인합니다.</p>
              </div>
              <button className="xbtn" onClick={() => setDetailLink(null)}>×</button>
            </div>
            <div className="detail-body">
              <div><Thumb link={detailLink} /></div>
              <div className="detail-copy">
                <div className="pills" style={{ marginTop: 0 }}>
                  <span className={`badge type-${typeOf(detailLink)}`}>{typeLabel(typeOf(detailLink))}</span>
                  <span className="badge">{detailLink.source === "local" ? "직접 추가" : "CSV 시드"}</span>
                </div>
                <div className="detail-note">{detailLink.note || "메모는 아직 없습니다."}</div>
                <div className="links">
                  {detailLink.shareUrl && <a className="link-btn" href={detailLink.shareUrl} target="_blank" rel="noreferrer">공유 링크 열기</a>}
                  {detailLink.archiveUrl && <a className="link-btn primary" href={detailLink.archiveUrl} target="_blank" rel="noreferrer">아카이브 열기</a>}
                </div>
                <div className="meta-grid">
                  <div className="meta-box"><strong>Date</strong><span>{formatDate(detailLink.date)}</span></div>
                  <div className="meta-box"><strong>Domain</strong><span>{domainOf(detailLink)}</span></div>
                  <div className="meta-box"><strong>Shared URL</strong><span style={{ wordBreak: "break-all", fontSize: 12 }}>{detailLink.shareUrl || "없음"}</span></div>
                  <div className="meta-box"><strong>Archive URL</strong><span style={{ wordBreak: "break-all", fontSize: 12 }}>{detailLink.archiveUrl || "없음"}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          link={editTarget}
          onSave={handleEditSaved}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          link={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      <div className={`toast${toastVisible ? " show" : ""}`}>{toast}</div>
    </>
  );
}
