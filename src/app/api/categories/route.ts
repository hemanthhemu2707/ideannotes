import { NextResponse } from 'next/server';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/notes';

// GET /api/categories - List all categories
export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error('API GET categories error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/categories - Create a new category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, icon, parentSlug } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 });
    }

    const newCat = await createCategory(name, icon || 'FolderOpen', parentSlug || null);
    return NextResponse.json({ success: true, category: newCat });
  } catch (error: any) {
    console.error('API POST category error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/categories - Update/Rename a category
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { oldSlug, newName } = body;

    if (!oldSlug || !newName) {
      return NextResponse.json({ success: false, error: 'Missing oldSlug or newName' }, { status: 400 });
    }

    const updated = await updateCategory(oldSlug, newName);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    console.error('API PUT category error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/categories - Delete a category
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Category slug is required' }, { status: 400 });
    }

    const deleted = await deleteCategory(slug);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Category and its files successfully deleted' });
  } catch (error: any) {
    console.error('API DELETE category error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
