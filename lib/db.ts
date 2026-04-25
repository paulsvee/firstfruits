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
  // ── 2026년 4월 (3) ──────────────────────────────────────────────────────────
  { title: "Ronaldinho: The One and Only — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=8BJc-L19h0E", archive: "https://www.youtube.com/watch?v=8BJc-L19h0E", date: "2026-04-16", category: "sports" },
  { title: "The Truth and Tragedy of Moriah Wilson — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=n0zKkQ9eUfY", archive: "https://www.youtube.com/watch?v=n0zKkQ9eUfY", date: "2026-04-03", category: "crime" },
  { title: "A Gorilla Story: Told by David Attenborough — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=u6Qs4W0uwBw", archive: "https://www.youtube.com/watch?v=u6Qs4W0uwBw", date: "2026-04-17", category: "nature" },
  // ── 2026년 3월 (4) ──────────────────────────────────────────────────────────
  { title: "The Dinosaurs — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=y4ZBSzYUTL0", archive: "https://www.youtube.com/watch?v=y4ZBSzYUTL0", date: "2026-03-06", category: "nature" },
  { title: "Fukushima: A Nuclear Nightmare — Official Trailer (HBO)", shareUrl: "https://www.youtube.com/watch?v=aKTmUdQQoZI", archive: "https://www.youtube.com/watch?v=aKTmUdQQoZI", date: "2026-03-10", category: "science" },
  { title: "Louis Theroux: Inside the Manosphere — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=Ms23FeJWvKU", archive: "https://www.youtube.com/watch?v=Ms23FeJWvKU", date: "2026-03-11", category: "social" },
  { title: "Dynasty: The Murdochs — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=a4BaDLZjE2c", archive: "https://www.youtube.com/watch?v=a4BaDLZjE2c", date: "2026-03-13", category: "people" },
  // ── 2025년 6월 (3) ──────────────────────────────────────────────────────────
  { title: "Pee-wee as Himself — Official Trailer (HBO)", shareUrl: "https://www.youtube.com/watch?v=jVx74C-RGDw", archive: "https://www.youtube.com/watch?v=jVx74C-RGDw", date: "2025-06-01", category: "people" },
  { title: "Titan: The OceanGate Disaster — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=CplcmrxZMyo", archive: "https://www.youtube.com/watch?v=CplcmrxZMyo", date: "2025-06-11", category: "science" },
  { title: "The Perfect Neighbor — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=fNp85HGJtoo", archive: "https://www.youtube.com/watch?v=fNp85HGJtoo", date: "2025-06-17", category: "crime" },
  // ── 2024년 10월 (4) ─────────────────────────────────────────────────────────
  { title: "Mr. McMahon — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=fwKm7WM_P8E", archive: "https://www.youtube.com/watch?v=fwKm7WM_P8E", date: "2024-10-01", category: "people" },
  { title: "Super/Man: The Christopher Reeve Story — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=gX-B3HMlMfY", archive: "https://www.youtube.com/watch?v=gX-B3HMlMfY", date: "2024-10-11", category: "people" },
  { title: "Martha — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=6blC6bsgZmc", archive: "https://www.youtube.com/watch?v=6blC6bsgZmc", date: "2024-10-20", category: "people" },
  { title: "Buy Now! The Shopping Conspiracy — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=OVfZw_eqJW8", archive: "https://www.youtube.com/watch?v=OVfZw_eqJW8", date: "2024-10-28", category: "social" },
  // ── 2024년 7월 (4) ──────────────────────────────────────────────────────────
  { title: "Sprint — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=qPaEwvY_rtg", archive: "https://www.youtube.com/watch?v=qPaEwvY_rtg", date: "2024-07-02", category: "sports" },
  { title: "Skywalkers: A Love Story — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=8jA1KpESAqk", archive: "https://www.youtube.com/watch?v=8jA1KpESAqk", date: "2024-07-19", category: "sports" },
  { title: "Mountain Queen: The Summits of Lhakpa Sherpa — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=0yz5F9WtmsI", archive: "https://www.youtube.com/watch?v=0yz5F9WtmsI", date: "2024-07-25", category: "sports" },
  { title: "Will & Harper — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=PRZ1ELeGepo", archive: "https://www.youtube.com/watch?v=PRZ1ELeGepo", date: "2024-07-27", category: "people" },
  // ── 2024년 2월 (3) ──────────────────────────────────────────────────────────
  { title: "American Nightmare — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=Yonx7CyoK3k", archive: "https://www.youtube.com/watch?v=Yonx7CyoK3k", date: "2024-02-01", category: "crime" },
  { title: "Lover, Stalker, Killer — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=46RuZLu6dso", archive: "https://www.youtube.com/watch?v=46RuZLu6dso", date: "2024-02-09", category: "crime" },
  { title: "Einstein and the Bomb — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=2t9RwElQGhg", archive: "https://www.youtube.com/watch?v=2t9RwElQGhg", date: "2024-02-16", category: "science" },
  // ── 2023년 11월 (4) ─────────────────────────────────────────────────────────
  { title: "Sly — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=_FMulgkArnw", archive: "https://www.youtube.com/watch?v=_FMulgkArnw", date: "2023-11-03", category: "people" },

  { title: "Daughters — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=SMTgDRqfLPE", archive: "https://www.youtube.com/watch?v=SMTgDRqfLPE", date: "2023-11-14", category: "social" },
  { title: "American Symphony — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=wKSMsdq8ONs", archive: "https://www.youtube.com/watch?v=wKSMsdq8ONs", date: "2023-11-29", category: "music" },
  // ── 2023년 7월 (6) ──────────────────────────────────────────────────────────
  { title: "Pamela, a love story — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=3SBJB8r8fVQ", archive: "https://www.youtube.com/watch?v=3SBJB8r8fVQ", date: "2023-07-01", category: "people" },
  { title: "Arnold — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=x2AEI26LBpA", archive: "https://www.youtube.com/watch?v=x2AEI26LBpA", date: "2023-07-03", category: "people" },
  { title: "Wham! — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=7fWzGF0tgcc", archive: "https://www.youtube.com/watch?v=7fWzGF0tgcc", date: "2023-07-05", category: "music" },
  { title: "Unknown: Cave of Bones — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=D85B4rVcFtk", archive: "https://www.youtube.com/watch?v=D85B4rVcFtk", date: "2023-07-17", category: "science" },
  { title: "The Deepest Breath — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=MzH6BI6P4Uo", archive: "https://www.youtube.com/watch?v=MzH6BI6P4Uo", date: "2023-07-19", category: "sports" },
  { title: "Beckham — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=nUVNbJMWi_c", archive: "https://www.youtube.com/watch?v=nUVNbJMWi_c", date: "2023-07-25", category: "sports" },
  // ── 2022년 11월 (5) ─────────────────────────────────────────────────────────
  { title: "Stutz — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=UKCmefQdplI", archive: "https://www.youtube.com/watch?v=UKCmefQdplI", date: "2022-11-01", category: "people" },
  { title: "Sr. — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=1qWUUGB7KUs", archive: "https://www.youtube.com/watch?v=1qWUUGB7KUs", date: "2022-11-05", category: "people" },
  { title: "Halftime — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=rpMZOZTqcQw", archive: "https://www.youtube.com/watch?v=rpMZOZTqcQw", date: "2022-11-10", category: "music" },
  { title: "Our Father — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=phQxK5u8IEs", archive: "https://www.youtube.com/watch?v=phQxK5u8IEs", date: "2022-11-15", category: "crime" },
  { title: "The Last Movie Stars — Official Trailer (HBO)", shareUrl: "https://www.youtube.com/watch?v=ESJaz4mFA3E", archive: "https://www.youtube.com/watch?v=ESJaz4mFA3E", date: "2022-11-21", category: "people" },
  // ── 2022년 7월 (4) ──────────────────────────────────────────────────────────
  { title: "Fire of Love — Official Trailer (National Geographic)", shareUrl: "https://www.youtube.com/watch?v=pH6Fn_RA21M", archive: "https://www.youtube.com/watch?v=pH6Fn_RA21M", date: "2022-07-06", category: "nature" },
  { title: "All That Breathes — Official Trailer (HBO)", shareUrl: "https://www.youtube.com/watch?v=GoTlULspDyY", archive: "https://www.youtube.com/watch?v=GoTlULspDyY", date: "2022-07-15", category: "nature" },
  { title: "Navalny — Official Trailer (2022)", shareUrl: "https://www.youtube.com/watch?v=ZF_HsKCWEHw", archive: "https://www.youtube.com/watch?v=ZF_HsKCWEHw", date: "2022-07-22", category: "social" },
  { title: "Return to Space — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=sIME4sLR4-8", archive: "https://www.youtube.com/watch?v=sIME4sLR4-8", date: "2022-07-28", category: "science" },
  // ── 2022년 2월 (4) ──────────────────────────────────────────────────────────
  { title: "The Puppet Master: Hunting the Ultimate Conman — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=vsVjVu31KL0", archive: "https://www.youtube.com/watch?v=vsVjVu31KL0", date: "2022-02-05", category: "crime" },
  { title: "The Tinder Swindler — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=Hb7AZcC88lg", archive: "https://www.youtube.com/watch?v=Hb7AZcC88lg", date: "2022-02-09", category: "crime" },
  { title: "Downfall: The Case Against Boeing — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=vt-IJkUbAxY", archive: "https://www.youtube.com/watch?v=vt-IJkUbAxY", date: "2022-02-18", category: "social" },
  { title: "Bad Vegan: Fame. Fraud. Fugitives. — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=4nTf7iViYUI", archive: "https://www.youtube.com/watch?v=4nTf7iViYUI", date: "2022-02-24", category: "crime" },
  // ── 2021년 11월 (5) ─────────────────────────────────────────────────────────
  { title: "The Beatles: Get Back — Official Trailer (Disney+)", shareUrl: "https://www.youtube.com/watch?v=Auta2lagtw4", archive: "https://www.youtube.com/watch?v=Auta2lagtw4", date: "2021-11-05", category: "music" },
  { title: "14 Peaks: Nothing Is Impossible — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=8QH5hBOoz08", archive: "https://www.youtube.com/watch?v=8QH5hBOoz08", date: "2021-11-10", category: "sports" },
  { title: "LuLaRich — Official Trailer (Prime Video)", shareUrl: "https://www.youtube.com/watch?v=mIkcrQzTr8w", archive: "https://www.youtube.com/watch?v=mIkcrQzTr8w", date: "2021-11-15", category: "social" },
  { title: "The Rescue — Official Trailer (National Geographic)", shareUrl: "https://www.youtube.com/watch?v=_-Kw5kAPSbk", archive: "https://www.youtube.com/watch?v=_-Kw5kAPSbk", date: "2021-11-20", category: "people" },
  { title: "Flee — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=2gOdc1mgK-o", archive: "https://www.youtube.com/watch?v=2gOdc1mgK-o", date: "2021-11-25", category: "social" },
  // ── 2021년 7월 (3) ──────────────────────────────────────────────────────────
  { title: "Summer of Soul — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=1-siC9cugqA", archive: "https://www.youtube.com/watch?v=1-siC9cugqA", date: "2021-07-02", category: "music" },
  { title: "Roadrunner: A Film About Anthony Bourdain — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=qbgKJPDo0tU", archive: "https://www.youtube.com/watch?v=qbgKJPDo0tU", date: "2021-07-16", category: "people" },
  { title: "Val — Official Trailer (Prime Video)", shareUrl: "https://www.youtube.com/watch?v=YqNnhgEyQCU", archive: "https://www.youtube.com/watch?v=YqNnhgEyQCU", date: "2021-07-23", category: "people" },
  // ── 2021년 3월 (3) ──────────────────────────────────────────────────────────
  { title: "Operation Varsity Blues — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=LFHj8e7mU_I", archive: "https://www.youtube.com/watch?v=LFHj8e7mU_I", date: "2021-03-17", category: "social" },
  { title: "Crack: Cocaine, Corruption & Conspiracy — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=RbYdjyxDNtQ", archive: "https://www.youtube.com/watch?v=RbYdjyxDNtQ", date: "2021-03-23", category: "social" },
  { title: "Seaspiracy — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=1Q5CXN7soQg", archive: "https://www.youtube.com/watch?v=1Q5CXN7soQg", date: "2021-03-24", category: "nature" },
  // ── 2021년 1월 (3) ──────────────────────────────────────────────────────────
  { title: "Night Stalker: The Hunt for a Serial Killer — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=Mva2nGveYss", archive: "https://www.youtube.com/watch?v=Mva2nGveYss", date: "2021-01-08", category: "crime" },
  { title: "Pretend It's a City — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=aPmWHZwyo5g", archive: "https://www.youtube.com/watch?v=aPmWHZwyo5g", date: "2021-01-13", category: "social" },
  { title: "Allen v. Farrow — Official Trailer (HBO)", shareUrl: "https://www.youtube.com/watch?v=cKTOj7HnLbo", archive: "https://www.youtube.com/watch?v=cKTOj7HnLbo", date: "2021-01-21", category: "crime" },
  // ── 2020년 9월 (4) ──────────────────────────────────────────────────────────
  { title: "My Octopus Teacher — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=3s0LTDhqe5A", archive: "https://www.youtube.com/watch?v=3s0LTDhqe5A", date: "2020-09-07", category: "nature" },
  { title: "The Social Dilemma — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=uaaC57tcci0", archive: "https://www.youtube.com/watch?v=uaaC57tcci0", date: "2020-09-09", category: "social" },
  { title: "Dick Johnson Is Dead — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=wfTmT6C5DnM", archive: "https://www.youtube.com/watch?v=wfTmT6C5DnM", date: "2020-09-15", category: "people" },
  { title: "David Attenborough: A Life on Our Planet — Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=64R2MYUt394", archive: "https://www.youtube.com/watch?v=64R2MYUt394", date: "2020-09-22", category: "nature" },
  // ── 2020년 3월 (3) ──────────────────────────────────────────────────────────
  { title: "Tiger King: Murder, Mayhem and Madness — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=acTdxsoa428", archive: "https://www.youtube.com/watch?v=acTdxsoa428", date: "2020-03-20", category: "crime" },
  { title: "Crip Camp: A Disability Revolution — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=XRrIs22plz0", archive: "https://www.youtube.com/watch?v=XRrIs22plz0", date: "2020-03-25", category: "social" },
  { title: "The Last Dance — Official Trailer (Netflix/ESPN)", shareUrl: "https://www.youtube.com/watch?v=U2uAYhLIqL0", archive: "https://www.youtube.com/watch?v=U2uAYhLIqL0", date: "2020-03-28", category: "sports" },
  // ── 2019년 8월 (5) ──────────────────────────────────────────────────────────
  { title: "Apollo 11 — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=BJ9YbxqLfzY", archive: "https://www.youtube.com/watch?v=BJ9YbxqLfzY", date: "2019-08-03", category: "science" },
  { title: "American Factory — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=m36QeKOJ2Fc", archive: "https://www.youtube.com/watch?v=m36QeKOJ2Fc", date: "2019-08-10", category: "social" },
  { title: "Knock Down the House — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=_wGZc8ZjFY4", archive: "https://www.youtube.com/watch?v=_wGZc8ZjFY4", date: "2019-08-15", category: "social" },
  { title: "The Cave — Official Trailer (National Geographic)", shareUrl: "https://www.youtube.com/watch?v=TaZkwBWuN2A", archive: "https://www.youtube.com/watch?v=TaZkwBWuN2A", date: "2019-08-21", category: "social" },
  { title: "For Sama — Official Trailer (PBS)", shareUrl: "https://www.youtube.com/watch?v=vsvBqtg2RM0", archive: "https://www.youtube.com/watch?v=vsvBqtg2RM0", date: "2019-08-27", category: "social" },
  // ── 2018년 6월 (4) ──────────────────────────────────────────────────────────
  { title: "RBG — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=biIRlcQqmOc", archive: "https://www.youtube.com/watch?v=biIRlcQqmOc", date: "2018-06-01", category: "people" },
  { title: "Won't You Be My Neighbor? — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=FhwktRDG_aQ", archive: "https://www.youtube.com/watch?v=FhwktRDG_aQ", date: "2018-06-08", category: "people" },
  { title: "Three Identical Strangers — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=uM5TQ4f7ycw", archive: "https://www.youtube.com/watch?v=uM5TQ4f7ycw", date: "2018-06-15", category: "crime" },
  { title: "Free Solo — Official Trailer (National Geographic)", shareUrl: "https://www.youtube.com/watch?v=urRVZ4SW7WU", archive: "https://www.youtube.com/watch?v=urRVZ4SW7WU", date: "2018-06-22", category: "sports" },
  // ── 2016년 11월 (4) ─────────────────────────────────────────────────────────
  { title: "13th — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=krfcq5pF8u8", archive: "https://www.youtube.com/watch?v=krfcq5pF8u8", date: "2016-11-01", category: "social" },
  { title: "Planet Earth II — Official Trailer (BBC)", shareUrl: "https://www.youtube.com/watch?v=c8aFcHFu8QM", archive: "https://www.youtube.com/watch?v=c8aFcHFu8QM", date: "2016-11-06", category: "nature" },
  { title: "I Am Not Your Negro — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=5SnzrT7PWZ0", archive: "https://www.youtube.com/watch?v=5SnzrT7PWZ0", date: "2016-11-12", category: "social" },
  { title: "Icarus — Official Trailer (Netflix)", shareUrl: "https://www.youtube.com/watch?v=qXoRdSTrR-4", archive: "https://www.youtube.com/watch?v=qXoRdSTrR-4", date: "2016-11-18", category: "crime" },
  // ── 2014년 10월 (4) ─────────────────────────────────────────────────────────
  { title: "Citizenfour — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=XiGwAvd5mvM", archive: "https://www.youtube.com/watch?v=XiGwAvd5mvM", date: "2014-10-01", category: "social" },
  { title: "Cosmos: A Spacetime Odyssey — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=Ln8UwPd1z20", archive: "https://www.youtube.com/watch?v=Ln8UwPd1z20", date: "2014-10-07", category: "science" },
  { title: "Blackfish — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=G93beiYiE74", archive: "https://www.youtube.com/watch?v=G93beiYiE74", date: "2014-10-13", category: "crime" },
  { title: "Jiro Dreams of Sushi — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=M-aGPniFvS0", archive: "https://www.youtube.com/watch?v=M-aGPniFvS0", date: "2014-10-19", category: "people" },
  // ── 2010년 4월 (3) ──────────────────────────────────────────────────────────
  { title: "Exit Through the Gift Shop — Official Trailer (Banksy)", shareUrl: "https://www.youtube.com/watch?v=oHJBdDSTbLw", archive: "https://www.youtube.com/watch?v=oHJBdDSTbLw", date: "2010-04-10", category: "music" },
  { title: "Senna — Official Trailer", shareUrl: "https://www.youtube.com/watch?v=sfosF-ZAbR4", archive: "https://www.youtube.com/watch?v=sfosF-ZAbR4", date: "2010-04-16", category: "sports" },
  { title: "Grizzly Man — Official Trailer (Werner Herzog)", shareUrl: "https://www.youtube.com/watch?v=uWA7GtDmNFU", archive: "https://www.youtube.com/watch?v=uWA7GtDmNFU", date: "2010-04-22", category: "nature" },
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
