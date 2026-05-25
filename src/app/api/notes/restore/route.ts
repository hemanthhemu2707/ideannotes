import { NextResponse } from 'next/server';
import { restoreNote } from '@/lib/notes';

// POST /api/notes/restore
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Missing required field: slug' }, { status: 400 });
    }

    const restored = await restoreNote(slug);

    if (!restored) {
      return NextResponse.json({ success: false, error: 'Soft-deleted note not found, or restore failed.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, note: restored });
  } catch (error: any) {
    console.error('API POST restore error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
