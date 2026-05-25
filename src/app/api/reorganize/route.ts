import { NextResponse } from 'next/server';
import { 
  reorganizeNote, 
  reorganizeCategory, 
  normalizeAndSwapCategoriesOrder, 
  normalizeAndSwapNotesOrder 
} from '@/lib/notes';
import { isAdmin as checkIsAdmin } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import sql from 'mssql';

export async function POST(request: Request) {
  try {
    const authenticated = await checkIsAdmin();
    if (!authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Administrative credentials required.' }, { status: 403 });
    }

    const body = await request.json();
    const draggedType = body.draggedType || body.type;
    const draggedSlug = body.draggedSlug;
    const targetSlug = body.targetSlug;
    let targetType = body.targetType;

    if (!draggedType || !draggedSlug) {
      return NextResponse.json({ success: false, error: 'Missing draggedType or draggedSlug' }, { status: 400 });
    }

    const pool = await getDbPool();

    // If targetType is not provided, detect it from database or context
    if (!targetType && targetSlug) {
      // Check if targetSlug is a note
      const noteCheck = await pool.request()
        .input('slug', sql.VarChar, targetSlug)
        .query('SELECT Slug FROM Notes WHERE Slug = @slug');
      if (noteCheck.recordset.length > 0) {
        targetType = 'note';
      } else {
        targetType = 'category';
      }
    } else if (!targetSlug) {
      // Nesting to root level
      targetType = 'root';
    }

    if (draggedType === 'note') {
      if (targetType === 'note') {
        // Drag note A onto note B: Sibling Swap!
        const success = await normalizeAndSwapNotesOrder(draggedSlug, targetSlug);
        if (success) {
          return NextResponse.json({ success: true, message: 'Notes reordered and swapped successfully.' });
        } else {
          return NextResponse.json({ success: false, error: 'Failed to reorder and swap notes.' }, { status: 500 });
        }
      } else {
        // Drag note A onto category B: Nesting/Moving Note into Category!
        if (!targetSlug || targetSlug === 'root') {
          return NextResponse.json({ success: false, error: 'A note must have a valid category parent.' }, { status: 400 });
        }
        const success = await reorganizeNote(draggedSlug, targetSlug);
        if (success) {
          return NextResponse.json({ success: true, message: 'Note successfully moved to category.' });
        } else {
          return NextResponse.json({ success: false, error: 'Failed to move note.' }, { status: 500 });
        }
      }
    } else if (draggedType === 'category') {
      if (targetType === 'note') {
        return NextResponse.json({ success: false, error: 'Cannot nest a category under a note.' }, { status: 400 });
      }

      // targetType is 'category' or 'root'
      const cleanTargetSlug = targetSlug === '' || targetSlug === 'root' || !targetSlug ? null : targetSlug;

      // Check if A and B are siblings to decide between Swapping vs Nesting!
      if (cleanTargetSlug) {
        // Get parent slugs of both categories to see if they are siblings
        const parentARes = await pool.request()
          .input('slugA', sql.VarChar, draggedSlug)
          .query('SELECT ParentSlug FROM Categories WHERE Slug = @slugA');
        const parentBRes = await pool.request()
          .input('slugB', sql.VarChar, cleanTargetSlug)
          .query('SELECT ParentSlug FROM Categories WHERE Slug = @slugB');

        const parentA = parentARes.recordset[0]?.ParentSlug;
        const parentB = parentBRes.recordset[0]?.ParentSlug;

        // If they have the same parent, they are siblings! Perform swap!
        if (parentARes.recordset.length > 0 && parentBRes.recordset.length > 0 && parentA === parentB) {
          const success = await normalizeAndSwapCategoriesOrder(draggedSlug, cleanTargetSlug);
          if (success) {
            return NextResponse.json({ success: true, message: 'Categories swapped successfully.' });
          } else {
            return NextResponse.json({ success: false, error: 'Failed to swap categories.' }, { status: 500 });
          }
        }
      }

      // Default to Nesting Category under target category (or root if null)
      try {
        const success = await reorganizeCategory(draggedSlug, cleanTargetSlug);
        if (success) {
          return NextResponse.json({ success: true, message: 'Category folder successfully re-nested.' });
        } else {
          return NextResponse.json({ success: false, error: 'Failed to reorganize category folder.' }, { status: 500 });
        }
      } catch (nestedError: any) {
        return NextResponse.json({ success: false, error: nestedError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid draggedType parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('API /api/reorganize error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
