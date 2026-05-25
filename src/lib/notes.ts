import sql from 'mssql';
import { getDbPool } from './db';

// Interfaces
export interface NoteMetadata {
  title: string;
  category: string;
  createdDate: string;
  updatedDate: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  originalPath?: string; // Used to restore deleted files
}

export interface Note {
  slug: string;
  categoryFolder: string;
  metadata: NoteMetadata;
  content: string;
  readingTime: number;
}

export interface Category {
  slug: string;
  name: string;
  icon: string;
  parentSlug?: string | null;
}

// Dummy backward-compatible function
export async function ensureDirectories() {
  // Database is used instead of filesystem, directory checks are no-op
}

// Map category name to folder slug
export function getCategoryFolder(category: string): string {
  return category
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_]+/g, '-')  // Spaces/underscores to hyphens
    .replace(/-+/g, '-');     // Prevent double hyphens
}

// Generate URL-safe slug from title
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

// Estimate reading time in minutes
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const cleanContent = content.replace(/[#*`[\]()]/g, ''); // strip markdown formatting symbols
  const wordsCount = cleanContent.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordsCount / wordsPerMinute));
}

// Mapping database row to Note object
const mapRowToNote = (row: any): Note => ({
  slug: row.Slug,
  categoryFolder: row.CategorySlug || 'uncategorized',
  content: row.Content,
  readingTime: row.ReadingTime,
  metadata: {
    title: row.Title,
    category: row.CategoryName || 'Uncategorized',
    createdDate: row.CreatedDate instanceof Date ? row.CreatedDate.toISOString() : new Date(row.CreatedDate).toISOString(),
    updatedDate: row.UpdatedDate instanceof Date ? row.UpdatedDate.toISOString() : new Date(row.UpdatedDate).toISOString(),
    tags: row.Tags ? row.Tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    pinned: !!row.Pinned,
    favorite: !!row.Favorite,
    originalPath: row.CategorySlug ? `${row.CategorySlug}/${row.Slug}.md` : undefined
  }
});

// Helper to resolve or create category by path (e.g. "Backend / C# / OOP Concepts")
export async function resolveCategoryPath(path: string): Promise<string> {
  if (!path) return 'uncategorized';
  
  const pool = await getDbPool();
  const parts = path.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return 'uncategorized';
  
  let currentParentSlug: string | null = null;
  let finalSlug = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partSlug = getCategoryFolder(part);
    const currentSlug: string = currentParentSlug ? `${currentParentSlug}-${partSlug}` : partSlug;
    
    // Check if slug already exists
    const existRes = await pool.request()
      .input('slug', sql.VarChar, currentSlug)
      .query('SELECT Slug FROM Categories WHERE Slug = @slug');
      
    if (existRes.recordset.length === 0) {
      // Create new category
      const icon = currentParentSlug ? 'Folder' : 'FolderOpen';
      await pool.request()
        .input('slug', sql.VarChar, currentSlug)
        .input('name', sql.NVarChar, part)
        .input('icon', sql.VarChar, icon)
        .input('parentSlug', sql.VarChar, currentParentSlug)
        .query('INSERT INTO Categories (Slug, Name, Icon, ParentSlug) VALUES (@slug, @name, @icon, @parentSlug)');
    }
    
    currentParentSlug = currentSlug;
    finalSlug = currentSlug;
  }
  
  return finalSlug;
}

// Retrieve all active notes
export async function getAllNotes(): Promise<Note[]> {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT n.*, c.Name as CategoryName 
      FROM Notes n
      INNER JOIN Categories c ON n.CategorySlug = c.Slug
      WHERE n.IsDeleted = 0
      ORDER BY n.SortOrder ASC, n.Pinned DESC, n.UpdatedDate DESC
    `);
    return res.recordset.map(mapRowToNote);
  } catch (error) {
    console.error('getAllNotes error:', error);
    return [];
  }
}

// Fetch a single note
export async function getNoteDetail(categoryFolder: string, slug: string): Promise<Note | null> {
  try {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('slug', sql.VarChar, slug)
      .query(`
        SELECT n.*, c.Name as CategoryName 
        FROM Notes n
        LEFT JOIN Categories c ON n.CategorySlug = c.Slug
        WHERE n.Slug = @slug
      `);
    if (res.recordset.length === 0) return null;
    return mapRowToNote(res.recordset[0]);
  } catch (error) {
    console.error(`Error reading note detail for ${slug}:`, error);
    return null;
  }
}

// Create a new note
export async function createNote(
  title: string,
  category: string,
  content: string,
  tags: string[] = [],
  pinned: boolean = false,
  favorite: boolean = false
): Promise<Note> {
  const slug = slugify(title);
  const categorySlug = await resolveCategoryPath(category);
  const readingTime = calculateReadingTime(content);
  const tagsStr = tags.join(',');
  
  const pool = await getDbPool();
  
  // Check if slug already exists to prevent duplicate key
  let finalSlug = slug;
  let attempt = 1;
  let slugExists = true;
  
  while (slugExists) {
    const existRes = await pool.request()
      .input('slug', sql.VarChar, finalSlug)
      .query('SELECT Slug FROM Notes WHERE Slug = @slug');
    if (existRes.recordset.length === 0) {
      slugExists = false;
    } else {
      finalSlug = `${slug}-${attempt}`;
      attempt++;
    }
  }
  
  const now = new Date();
  await pool.request()
    .input('slug', sql.VarChar, finalSlug)
    .input('title', sql.NVarChar, title)
    .input('categorySlug', sql.VarChar, categorySlug)
    .input('content', sql.NVarChar, content)
    .input('tags', sql.NVarChar, tagsStr)
    .input('pinned', sql.Bit, pinned ? 1 : 0)
    .input('favorite', sql.Bit, favorite ? 1 : 0)
    .input('readingTime', sql.Int, readingTime)
    .input('now', sql.DateTime2, now)
    .query(`
      INSERT INTO Notes (Slug, Title, CategorySlug, Content, Tags, Pinned, Favorite, ReadingTime, CreatedDate, UpdatedDate, IsDeleted)
      VALUES (@slug, @title, @categorySlug, @content, @tags, @pinned, @favorite, @readingTime, @now, @now, 0)
    `);
     
  // Fetch Category Name
  const catRes = await pool.request()
    .input('slug', sql.VarChar, categorySlug)
    .query('SELECT Name FROM Categories WHERE Slug = @slug');
  const categoryName = catRes.recordset[0]?.Name || category;
  
  return {
    slug: finalSlug,
    categoryFolder: categorySlug,
    readingTime,
    content,
    metadata: {
      title,
      category: categoryName,
      createdDate: now.toISOString(),
      updatedDate: now.toISOString(),
      tags,
      pinned,
      favorite
    }
  };
}

// Update an existing note
export async function updateNote(
  originalCategoryFolder: string,
  originalSlug: string,
  title: string,
  category: string,
  content: string,
  tags: string[] = [],
  pinned: boolean = false,
  favorite: boolean = false
): Promise<Note | null> {
  const pool = await getDbPool();
  
  // Verify the note exists
  const existRes = await pool.request()
    .input('slug', sql.VarChar, originalSlug)
    .query('SELECT * FROM Notes WHERE Slug = @slug');
     
  if (existRes.recordset.length === 0) return null;
  const originalNote = existRes.recordset[0];
  
  const categorySlug = await resolveCategoryPath(category);
  const newSlug = slugify(title);
  const readingTime = calculateReadingTime(content);
  const tagsStr = tags.join(',');
  const now = new Date();
  
  // If slug changed, we must verify newSlug doesn't collide
  let finalSlug = originalSlug;
  if (originalSlug !== newSlug) {
    finalSlug = newSlug;
    let attempt = 1;
    let slugExists = true;
    while (slugExists) {
      const collisionRes = await pool.request()
        .input('slug', sql.VarChar, finalSlug)
        .input('origSlug', sql.VarChar, originalSlug)
        .query('SELECT Slug FROM Notes WHERE Slug = @slug AND Slug <> @origSlug');
      if (collisionRes.recordset.length === 0) {
        slugExists = false;
      } else {
        finalSlug = `${newSlug}-${attempt}`;
        attempt++;
      }
    }
    
    // Update note including slug
    await pool.request()
      .input('origSlug', sql.VarChar, originalSlug)
      .input('slug', sql.VarChar, finalSlug)
      .input('title', sql.NVarChar, title)
      .input('categorySlug', sql.VarChar, categorySlug)
      .input('content', sql.NVarChar, content)
      .input('tags', sql.NVarChar, tagsStr)
      .input('pinned', sql.Bit, pinned ? 1 : 0)
      .input('favorite', sql.Bit, favorite ? 1 : 0)
      .input('readingTime', sql.Int, readingTime)
      .input('now', sql.DateTime2, now)
      .query(`
        UPDATE Notes 
        SET Slug = @slug, Title = @title, CategorySlug = @categorySlug, Content = @content, 
            Tags = @tags, Pinned = @pinned, Favorite = @favorite, ReadingTime = @readingTime, 
            UpdatedDate = @now
        WHERE Slug = @origSlug
      `);
  } else {
    // Same slug, plain update
    await pool.request()
      .input('slug', sql.VarChar, originalSlug)
      .input('title', sql.NVarChar, title)
      .input('categorySlug', sql.VarChar, categorySlug)
      .input('content', sql.NVarChar, content)
      .input('tags', sql.NVarChar, tagsStr)
      .input('pinned', sql.Bit, pinned ? 1 : 0)
      .input('favorite', sql.Bit, favorite ? 1 : 0)
      .input('readingTime', sql.Int, readingTime)
      .input('now', sql.DateTime2, now)
      .query(`
        UPDATE Notes 
        SET Title = @title, CategorySlug = @categorySlug, Content = @content, 
            Tags = @tags, Pinned = @pinned, Favorite = @favorite, ReadingTime = @readingTime, 
            UpdatedDate = @now
        WHERE Slug = @slug
      `);
  }
  
  // Fetch Category Name
  const catRes = await pool.request()
    .input('slug', sql.VarChar, categorySlug)
    .query('SELECT Name FROM Categories WHERE Slug = @slug');
  const categoryName = catRes.recordset[0]?.Name || category;
  
  return {
    slug: finalSlug,
    categoryFolder: categorySlug,
    readingTime,
    content,
    metadata: {
      title,
      category: categoryName,
      createdDate: originalNote.CreatedDate instanceof Date ? originalNote.CreatedDate.toISOString() : new Date(originalNote.CreatedDate).toISOString(),
      updatedDate: now.toISOString(),
      tags,
      pinned,
      favorite
    }
  };
}

// Delete note (soft or permanent)
export async function deleteNote(categoryFolder: string, slug: string, permanent: boolean = false): Promise<boolean> {
  try {
    const pool = await getDbPool();
    if (permanent || categoryFolder === 'recently-deleted') {
      const res = await pool.request()
        .input('slug', sql.VarChar, slug)
        .query('DELETE FROM Notes WHERE Slug = @slug');
      return (res.rowsAffected[0] || 0) > 0;
    } else {
      // Soft delete
      const res = await pool.request()
        .input('slug', sql.VarChar, slug)
        .input('now', sql.DateTime2, new Date())
        .query('UPDATE Notes SET IsDeleted = 1, DeletedDate = @now WHERE Slug = @slug');
      return (res.rowsAffected[0] || 0) > 0;
    }
  } catch (error) {
    console.error('deleteNote error:', error);
    return false;
  }
}

// Restore a note from recently-deleted
export async function restoreNote(slug: string): Promise<Note | null> {
  try {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('slug', sql.VarChar, slug)
      .query('UPDATE Notes SET IsDeleted = 0, DeletedDate = NULL WHERE Slug = @slug');
      
    if ((res.rowsAffected[0] || 0) === 0) return null;
    
    return getNoteDetail('', slug);
  } catch (error) {
    console.error(`Failed to restore note with slug "${slug}":`, error);
    return null;
  }
}

// Get all soft-deleted notes in the trash
export async function getRecentlyDeletedNotes(): Promise<Note[]> {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query(`
      SELECT n.*, c.Name as CategoryName 
      FROM Notes n
      LEFT JOIN Categories c ON n.CategorySlug = c.Slug
      WHERE n.IsDeleted = 1
      ORDER BY n.DeletedDate DESC
    `);
    return res.recordset.map(mapRowToNote);
  } catch (error) {
    console.error('getRecentlyDeletedNotes error:', error);
    return [];
  }
}

// Dynamic Category CRUD Management
export async function getCategories(): Promise<Category[]> {
  try {
    const pool = await getDbPool();
    const res = await pool.request().query('SELECT Slug as slug, Name as name, Icon as icon, ParentSlug as parentSlug FROM Categories ORDER BY SortOrder ASC, Name ASC');
    return res.recordset as Category[];
  } catch (error) {
    console.error('getCategories error:', error);
    return [];
  }
}

export async function createCategory(name: string, icon: string = 'FolderOpen', parentSlug: string | null = null): Promise<Category> {
  const slug = getCategoryFolder(name);
  const pool = await getDbPool();
  
  // Check collision
  const existRes = await pool.request()
    .input('slug', sql.VarChar, slug)
    .query('SELECT Slug FROM Categories WHERE Slug = @slug');
     
  if (existRes.recordset.length > 0) {
    throw new Error('Category already exists.');
  }
  
  await pool.request()
    .input('slug', sql.VarChar, slug)
    .input('name', sql.NVarChar, name)
    .input('icon', sql.VarChar, icon)
    .input('parentSlug', sql.VarChar, parentSlug)
    .query('INSERT INTO Categories (Slug, Name, Icon, ParentSlug) VALUES (@slug, @name, @icon, @parentSlug)');
     
  return { slug, name, icon, parentSlug };
}

export async function updateCategory(oldSlug: string, newName: string): Promise<Category | null> {
  const pool = await getDbPool();
  const newSlug = getCategoryFolder(newName);
  
  // Verify old exists
  const existRes = await pool.request()
    .input('slug', sql.VarChar, oldSlug)
    .query('SELECT * FROM Categories WHERE Slug = @slug');
     
  if (existRes.recordset.length === 0) return null;
  const originalCat = existRes.recordset[0];
  
  if (oldSlug !== newSlug) {
    // 1. Create the new category with same icon
    await pool.request()
      .input('newSlug', sql.VarChar, newSlug)
      .input('newName', sql.NVarChar, newName)
      .input('icon', sql.VarChar, originalCat.Icon)
      .query('IF NOT EXISTS (SELECT * FROM Categories WHERE Slug = @newSlug) INSERT INTO Categories (Slug, Name, Icon) VALUES (@newSlug, @newName, @icon)');
       
    // 2. Point all notes inside oldSlug to newSlug
    await pool.request()
      .input('oldSlug', sql.VarChar, oldSlug)
      .input('newSlug', sql.VarChar, newSlug)
      .query('UPDATE Notes SET CategorySlug = @newSlug WHERE CategorySlug = @oldSlug');
       
    // 3. Point all preparation guides inside oldSlug to newSlug
    await pool.request()
      .input('oldSlug', sql.VarChar, oldSlug)
      .input('newSlug', sql.VarChar, newSlug)
      .query('UPDATE PreparationGuides SET CategorySlug = @newSlug WHERE CategorySlug = @oldSlug');
       
    // 4. Delete the old category
    await pool.request()
      .input('oldSlug', sql.VarChar, oldSlug)
      .query('DELETE FROM Categories WHERE Slug = @oldSlug');
  } else {
    // Slug is identical, only update name
    await pool.request()
      .input('slug', sql.VarChar, oldSlug)
      .input('name', sql.NVarChar, newName)
      .query('UPDATE Categories SET Name = @name WHERE Slug = @slug');
  }
  
  return { slug: newSlug, name: newName, icon: originalCat.Icon };
}

export async function deleteCategory(slug: string): Promise<boolean> {
  try {
    const pool = await getDbPool();
    // Soft-delete all notes belonging to the category first
    await pool.request()
      .input('slug', sql.VarChar, slug)
      .input('now', sql.DateTime2, new Date())
      .query('UPDATE Notes SET CategorySlug = NULL, IsDeleted = 1, DeletedDate = @now WHERE CategorySlug = @slug');
       
    const res = await pool.request()
      .input('slug', sql.VarChar, slug)
      .query('DELETE FROM Categories WHERE Slug = @slug');
       
    return (res.rowsAffected[0] || 0) > 0;
  } catch (error) {
    console.error('deleteCategory error:', error);
    return false;
  }
}

export async function reorganizeNote(noteSlug: string, targetCategorySlug: string): Promise<boolean> {
  try {
    const pool = await getDbPool();
    const res = await pool.request()
      .input('noteSlug', sql.VarChar, noteSlug)
      .input('targetCategorySlug', sql.VarChar, targetCategorySlug)
      .query('UPDATE Notes SET CategorySlug = @targetCategorySlug, UpdatedDate = GETDATE() WHERE Slug = @noteSlug');
    return (res.rowsAffected[0] || 0) > 0;
  } catch (error) {
    console.error('reorganizeNote error:', error);
    return false;
  }
}

export async function reorganizeCategory(categorySlug: string, targetParentSlug: string | null): Promise<boolean> {
  try {
    const pool = await getDbPool();
    // Prevent infinite cyclic hierarchy assignments
    if (targetParentSlug) {
      if (categorySlug === targetParentSlug) {
        throw new Error('A category cannot be its own parent.');
      }
      let currentParent: string | null = targetParentSlug;
      while (currentParent) {
        if (currentParent === categorySlug) {
          throw new Error('Cyclic folder nesting detected. You cannot drag a parent folder inside its own child sub-folder!');
        }
        const parentRes: any = await pool.request()
          .input('slug', sql.VarChar, currentParent)
          .query('SELECT ParentSlug FROM Categories WHERE Slug = @slug');
        if (parentRes.recordset.length === 0) break;
        currentParent = parentRes.recordset[0].ParentSlug;
      }
    }

    const res = await pool.request()
      .input('categorySlug', sql.VarChar, categorySlug)
      .input('targetParentSlug', sql.VarChar, targetParentSlug)
      .query('UPDATE Categories SET ParentSlug = @targetParentSlug WHERE Slug = @categorySlug');
    return (res.rowsAffected[0] || 0) > 0;
  } catch (error) {
    console.error('reorganizeCategory error:', error);
    return false;
  }
}

export async function normalizeAndSwapCategoriesOrder(slugA: string, slugB: string): Promise<boolean> {
  try {
    const pool = await getDbPool();
    // 1. Get parent slug of slugA
    const parentRes = await pool.request()
      .input('slugA', sql.VarChar, slugA)
      .query('SELECT ParentSlug FROM Categories WHERE Slug = @slugA');
    if (parentRes.recordset.length === 0) return false;
    const parentSlug = parentRes.recordset[0].ParentSlug;

    // 2. Fetch all siblings in that sibling group
    const siblingsRes = await pool.request()
      .input('parentSlug', sql.VarChar, parentSlug)
      .query(
        parentSlug === null
          ? 'SELECT Slug, SortOrder FROM Categories WHERE ParentSlug IS NULL ORDER BY SortOrder ASC, Name ASC'
          : 'SELECT Slug, SortOrder FROM Categories WHERE ParentSlug = @parentSlug ORDER BY SortOrder ASC, Name ASC'
      );
    
    const siblings = siblingsRes.recordset;
    
    // 3. Update all siblings with consecutive sequential SortOrder values to normalize
    for (let idx = 0; idx < siblings.length; idx++) {
      const siblingSlug = siblings[idx].Slug;
      await pool.request()
        .input('slug', sql.VarChar, siblingSlug)
        .input('sortOrder', sql.Int, idx)
        .query('UPDATE Categories SET SortOrder = @sortOrder WHERE Slug = @slug');
    }

    // 4. Retrieve normalized indices
    const orderARes = siblings.findIndex(s => s.Slug === slugA);
    const orderBRes = siblings.findIndex(s => s.Slug === slugB);
    
    if (orderARes === -1 || orderBRes === -1) return false;

    // 5. Swap the sort orders of A and B
    await pool.request()
      .input('slugA', sql.VarChar, slugA)
      .input('orderB', sql.Int, orderBRes)
      .query('UPDATE Categories SET SortOrder = @orderB WHERE Slug = @slugA');

    await pool.request()
      .input('slugB', sql.VarChar, slugB)
      .input('orderA', sql.Int, orderARes)
      .query('UPDATE Categories SET SortOrder = @orderA WHERE Slug = @slugB');

    return true;
  } catch (error) {
    console.error('normalizeAndSwapCategoriesOrder error:', error);
    return false;
  }
}

export async function normalizeAndSwapNotesOrder(slugA: string, slugB: string): Promise<boolean> {
  try {
    const pool = await getDbPool();
    // 1. Get categories of both notes
    const noteARes = await pool.request()
      .input('slugA', sql.VarChar, slugA)
      .query('SELECT CategorySlug FROM Notes WHERE Slug = @slugA');
    const noteBRes = await pool.request()
      .input('slugB', sql.VarChar, slugB)
      .query('SELECT CategorySlug FROM Notes WHERE Slug = @slugB');
      
    if (noteARes.recordset.length === 0 || noteBRes.recordset.length === 0) return false;
    
    const catA = noteARes.recordset[0].CategorySlug;
    const catB = noteBRes.recordset[0].CategorySlug;

    // 2. If different categories (cross-category move), move note A to B's category first!
    if (catA !== catB) {
      await pool.request()
        .input('slugA', sql.VarChar, slugA)
        .input('catB', sql.VarChar, catB)
        .query('UPDATE Notes SET CategorySlug = @catB, UpdatedDate = GETDATE() WHERE Slug = @slugA');
    }

    // 3. Fetch all active notes in the target category (catB)
    const siblingsRes = await pool.request()
      .input('categorySlug', sql.VarChar, catB)
      .query('SELECT Slug, SortOrder FROM Notes WHERE CategorySlug = @categorySlug AND IsDeleted = 0 ORDER BY SortOrder ASC, Pinned DESC, UpdatedDate DESC');
      
    const siblings = siblingsRes.recordset;

    // 4. Update all siblings with consecutive sequential SortOrder values to normalize
    for (let idx = 0; idx < siblings.length; idx++) {
      const siblingSlug = siblings[idx].Slug;
      await pool.request()
        .input('slug', sql.VarChar, siblingSlug)
        .input('sortOrder', sql.Int, idx)
        .query('UPDATE Notes SET SortOrder = @sortOrder WHERE Slug = @slug');
    }

    // 5. Retrieve normalized indices
    const orderARes = siblings.findIndex(s => s.Slug === slugA);
    const orderBRes = siblings.findIndex(s => s.Slug === slugB);

    if (orderARes === -1 || orderBRes === -1) return false;

    // 6. Swap their sort orders
    await pool.request()
      .input('slugA', sql.VarChar, slugA)
      .input('orderB', sql.Int, orderBRes)
      .query('UPDATE Notes SET SortOrder = @orderB WHERE Slug = @slugA');

    await pool.request()
      .input('slugB', sql.VarChar, slugB)
      .input('orderA', sql.Int, orderARes)
      .query('UPDATE Notes SET SortOrder = @orderA WHERE Slug = @slugB');

    return true;
  } catch (error) {
    console.error('normalizeAndSwapNotesOrder error:', error);
    return false;
  }
}
