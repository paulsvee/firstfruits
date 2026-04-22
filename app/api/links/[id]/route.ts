import { NextRequest, NextResponse } from "next/server";
import { deleteLink, updateLink, getAllLinks } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  deleteLink(params.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  updateLink(params.id, {
    title: body.title,
    shareUrl: body.shareUrl,
    archiveUrl: body.archiveUrl,
    date: body.date,
    thumb: body.thumb,
    note: body.note,
    category: body.category,
  });
  const updated = getAllLinks().find(l => l.id === params.id);
  return NextResponse.json(updated);
}
