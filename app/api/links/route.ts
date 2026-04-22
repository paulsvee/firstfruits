import { NextRequest, NextResponse } from "next/server";
import { getAllLinks, createLink } from "@/lib/db";

export async function GET() {
  const links = getAllLinks();
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, shareUrl, archiveUrl, date, thumb, note } = body;

  if (!shareUrl && !archiveUrl) {
    return NextResponse.json({ error: "공유 링크나 아카이브 링크 중 하나는 필요합니다." }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "날짜를 입력해 주세요." }, { status: 400 });
  }

  const link = createLink({ title: title || "", shareUrl: shareUrl || "", archiveUrl: archiveUrl || "", date, thumb: thumb || "", note: note || "" });
  return NextResponse.json(link, { status: 201 });
}
