import { NextResponse } from 'next/server';
import { 
  getAllNotes, 
  createNote, 
  updateNote, 
  deleteNote, 
  getRecentlyDeletedNotes 
} from '@/lib/notes';
import { isAdmin as checkIsAdmin } from '@/lib/auth';
import { emojiSearchMatch } from '@/lib/emojiSearch';

// GET /api/notes - List notes with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const trash = searchParams.get('trash') === 'true';

    let notes = trash ? await getRecentlyDeletedNotes() : await getAllNotes();

    // Apply category filter
    if (category) {
      const cleanCategory = category.toLowerCase().trim();
      notes = notes.filter(n => n.categoryFolder === cleanCategory || n.metadata.category.toLowerCase() === cleanCategory);
    }

    // Apply tag filter
    if (tag) {
      const cleanTag = tag.toLowerCase().trim();
      notes = notes.filter(n => n.metadata.tags.some(t => t.toLowerCase() === cleanTag));
    }

    // Apply search filter (searches title, category, tags, and body content)
    if (search) {
      notes = notes.filter(n => {
        const titleMatch = emojiSearchMatch(n.metadata.title, search);
        const categoryMatch = emojiSearchMatch(n.metadata.category, search);
        const tagMatch = n.metadata.tags.some(t => emojiSearchMatch(t, search));
        const contentMatch = emojiSearchMatch(n.content, search);
        return titleMatch || categoryMatch || tagMatch || contentMatch;
      });
    }

    return NextResponse.json({ success: true, notes });
  } catch (error: any) {
    console.error('API GET notes error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/notes - Create a new note
export async function POST(request: Request) {
  try {
    const authenticated = await checkIsAdmin();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrative credentials required.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, category, content, tags, pinned, favorite } = body;

    if (!title || !category || !content) {
      return NextResponse.json({ success: false, error: 'Missing required fields: title, category, content' }, { status: 400 });
    }

    const newNote = await createNote(
      title,
      category,
      content,
      tags || [],
      !!pinned,
      !!favorite
    );

    return NextResponse.json({ success: true, note: newNote });
  } catch (error: any) {
    console.error('API POST note error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/notes - Update an existing note
export async function PUT(request: Request) {
  try {
    const authenticated = await checkIsAdmin();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrative credentials required.' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      originalCategoryFolder, 
      originalSlug, 
      title, 
      category, 
      content, 
      tags, 
      pinned, 
      favorite 
    } = body;

    if (!originalCategoryFolder || !originalSlug || !title || !category || !content) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing fields: originalCategoryFolder, originalSlug, title, category, content' 
      }, { status: 400 });
    }

    const updated = await updateNote(
      originalCategoryFolder,
      originalSlug,
      title,
      category,
      content,
      tags || [],
      !!pinned,
      !!favorite
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Original note not found' }, { status: 44 });
    }

    return NextResponse.json({ success: true, note: updated });
  } catch (error: any) {
    console.error('API PUT note error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/notes - Delete a note (soft or permanent)
export async function DELETE(request: Request) {
  try {
    const authenticated = await checkIsAdmin();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrative credentials required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const categoryFolder = searchParams.get('categoryFolder');
    const slug = searchParams.get('slug');
    const permanent = searchParams.get('permanent') === 'true';

    if (!categoryFolder || !slug) {
      return NextResponse.json({ success: false, error: 'Missing query parameters: categoryFolder, slug' }, { status: 400 });
    }

    const deleted = await deleteNote(categoryFolder, slug, permanent);

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 44 });
    }

    return NextResponse.json({ success: true, message: permanent ? 'Permanently deleted' : 'Soft-deleted' });
  } catch (error: any) {
    console.error('API DELETE note error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
