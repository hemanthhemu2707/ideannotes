import { NextResponse } from 'next/server';
import { getNoteDetail } from '@/lib/notes';

// GET /api/notes/detail?categoryFolder=...&slug=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryFolder = searchParams.get('categoryFolder');
    const slug = searchParams.get('slug');

    if (!categoryFolder || !slug) {
      return NextResponse.json({ success: false, error: 'Missing query parameters: categoryFolder, slug' }, { status: 400 });
    }

    const note = await getNoteDetail(categoryFolder, slug);

    if (!note) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    console.error('API GET note detail error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
