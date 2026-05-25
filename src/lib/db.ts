import sql from 'mssql';
import crypto from 'crypto';

const dbConfig: sql.config = {
  user: 'db51417',
  password: '6Cq@-8HaNt5?',
  server: 'db51417.public.databaseasp.net',
  database: 'db51417',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000
  }
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

// SHA-256 Hashing helper
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function getDbPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then(async (pool) => {
        console.log('Connected to MS SQL Server successfully!');
        await initDb(pool);
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error('Database connection failed:', err);
        throw err;
      });
  }
  return poolPromise;
}

// Database schema and starter data initializer
async function initDb(pool: sql.ConnectionPool) {
  try {
    console.log('Verifying SQL Server database tables and establishing indexes...');
    
    // Combined Batch 1: Schema creation & optimized index creation
    await pool.request().query(`
      -- 1. Create Categories Table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Categories')
      BEGIN
          CREATE TABLE Categories (
              Slug VARCHAR(100) PRIMARY KEY,
              Name NVARCHAR(100) NOT NULL,
              Icon VARCHAR(50) NOT NULL
          );
      END

      -- Add ParentSlug to Categories if it doesn't exist
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Categories') AND name = 'ParentSlug')
      BEGIN
          ALTER TABLE Categories ADD ParentSlug VARCHAR(100) NULL FOREIGN KEY REFERENCES Categories(Slug) ON DELETE NO ACTION;
      END

      -- Add SortOrder to Categories if it doesn't exist
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Categories') AND name = 'SortOrder')
      BEGIN
          ALTER TABLE Categories ADD SortOrder INT NOT NULL DEFAULT 0;
      END

      -- 2. Create Notes Table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notes')
      BEGIN
          CREATE TABLE Notes (
              Slug VARCHAR(150) PRIMARY KEY,
              Title NVARCHAR(250) NOT NULL,
              CategorySlug VARCHAR(100) FOREIGN KEY REFERENCES Categories(Slug) ON DELETE CASCADE,
              Content NVARCHAR(MAX) NOT NULL,
              Tags NVARCHAR(500) NULL,
              Pinned BIT NOT NULL DEFAULT 0,
              Favorite BIT NOT NULL DEFAULT 0,
              CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
              UpdatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
              ReadingTime INT NOT NULL DEFAULT 1,
              IsDeleted BIT NOT NULL DEFAULT 0,
              DeletedDate DATETIME2 NULL
          );
          
          CREATE INDEX IX_Notes_Category ON Notes(CategorySlug);
          CREATE INDEX IX_Notes_IsDeleted ON Notes(IsDeleted, Pinned, UpdatedDate DESC);
      END

      -- Add SortOrder to Notes if it doesn't exist
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Notes') AND name = 'SortOrder')
      BEGIN
          ALTER TABLE Notes ADD SortOrder INT NOT NULL DEFAULT 0;
      END

      -- 3. Create Users Table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
      BEGIN
          CREATE TABLE Users (
              Id INT IDENTITY(1,1) PRIMARY KEY,
              Username VARCHAR(100) UNIQUE NOT NULL,
              PasswordHash VARCHAR(250) NOT NULL,
              Role VARCHAR(50) NOT NULL DEFAULT 'User',
              Email VARCHAR(150) NULL,
              IsApproved BIT NOT NULL DEFAULT 0
          );
      END

      -- Add Email to Users if it doesn't exist
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Email')
      BEGIN
          ALTER TABLE Users ADD Email VARCHAR(150) NULL;
      END

      -- Add IsApproved to Users if it doesn't exist
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'IsApproved')
      BEGIN
          ALTER TABLE Users ADD IsApproved BIT NOT NULL DEFAULT 0;
      END

      -- 4. Create InterviewSchedules Table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InterviewSchedules')
      BEGIN
          CREATE TABLE InterviewSchedules (
              Id INT IDENTITY(1,1) PRIMARY KEY,
              Company NVARCHAR(150) NOT NULL,
              Role NVARCHAR(150) NOT NULL,
              ScheduleDate DATETIME2 NOT NULL,
              Notes NVARCHAR(MAX) NULL,
              Completed BIT NOT NULL DEFAULT 0
          );
          
          CREATE INDEX IX_Schedules_Date ON InterviewSchedules(ScheduleDate, Completed);
      END

      -- 5. Create PreparationGuides Table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PreparationGuides')
      BEGIN
          CREATE TABLE PreparationGuides (
              Id INT IDENTITY(1,1) PRIMARY KEY,
              Title NVARCHAR(250) NOT NULL,
              CategorySlug VARCHAR(100) FOREIGN KEY REFERENCES Categories(Slug) ON DELETE SET NULL,
              Topic NVARCHAR(250) NOT NULL,
              Status VARCHAR(50) NOT NULL DEFAULT 'Not Started'
          );
      END

      -- 6. Create Comments Table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Comments')
      BEGIN
          CREATE TABLE Comments (
              Id INT IDENTITY(1,1) PRIMARY KEY,
              NoteSlug VARCHAR(150) NOT NULL FOREIGN KEY REFERENCES Notes(Slug) ON DELETE CASCADE,
              Author NVARCHAR(100) NOT NULL,
              Content NVARCHAR(MAX) NOT NULL,
              CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
              Email VARCHAR(150) NULL
          );
          CREATE INDEX IX_Comments_NoteSlug ON Comments(NoteSlug, CreatedDate DESC);
      END

      -- Add Email to Comments if it doesn't exist
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Comments' AND COLUMN_NAME = 'Email')
      BEGIN
          ALTER TABLE Comments ADD Email VARCHAR(150) NULL;
      END

      -- 6b. Create OtpCodes Table
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OtpCodes')
      BEGIN
          CREATE TABLE OtpCodes (
              Email VARCHAR(150) PRIMARY KEY,
              Code VARCHAR(6) NOT NULL,
              ExpiresAt DATETIME2 NOT NULL
          );
      END

      -- Ensure default admin is approved
      UPDATE Users SET IsApproved = 1 WHERE Username = 'admin';

      -- 7. Add High-Performance Covering Indexes for SortOrder and queries
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Categories_SortOrder' AND object_id = OBJECT_ID('Categories'))
      BEGIN
          CREATE INDEX IX_Categories_SortOrder ON Categories(SortOrder, Name);
      END

      -- Add covering index for active notes query
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Notes_ActiveSort' AND object_id = OBJECT_ID('Notes'))
      BEGIN
          CREATE INDEX IX_Notes_ActiveSort ON Notes(IsDeleted, SortOrder, Pinned, UpdatedDate DESC) INCLUDE (Slug, Title, CategorySlug, ReadingTime);
      END
    `);

    // Combined Batch 2: Fetch counts of all tables in a single round-trip
    const countsRes = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM Users) as UsersCount,
        (SELECT COUNT(*) FROM Categories) as CategoriesCount,
        (SELECT COUNT(*) FROM PreparationGuides) as GuidesCount,
        (SELECT COUNT(*) FROM Notes) as NotesCount
    `);
    
    const counts = countsRes.recordset[0];

    // Pre-populate Default Admin Account
    if (counts.UsersCount === 0) {
      console.log('Pre-populating default admin account...');
      const adminHash = hashPassword('admin123');
      await pool.request()
        .input('username', sql.VarChar, 'admin')
        .input('hash', sql.VarChar, adminHash)
        .input('role', sql.VarChar, 'Admin')
        .query('INSERT INTO Users (Username, PasswordHash, Role) VALUES (@username, @hash, @role)');
    }

    // Pre-populate Categories
    if (counts.CategoriesCount === 0) {
      console.log('Pre-populating default categories list...');
      await pool.request().query(`
        INSERT INTO Categories (Slug, Name, Icon) VALUES
        ('dotnet', '.NET', 'FileCode'),
        ('dotnet-core', '.NET Core', 'FileCode'),
        ('entity-framework', 'Entity Framework', 'FileCode'),
        ('react', 'React', 'Layers'),
        ('angular', 'Angular', 'Layers'),
        ('javascript', 'JavaScript', 'Layers'),
        ('sql', 'SQL', 'Database'),
        ('design-patterns', 'Design Patterns', 'Puzzle'),
        ('apis', 'APIs', 'Webhook'),
        ('security', 'Security', 'Shield'),
        ('system-design', 'System Design', 'Network')
      `);
    }

    // Pre-populate dynamic preparation guides checklist
    if (counts.GuidesCount === 0) {
      console.log('Pre-populating default preparation checklists...');
      await pool.request().query(`
        INSERT INTO PreparationGuides (Title, CategorySlug, Topic, Status) VALUES
        ('Transient vs Scoped vs Singleton', 'dotnet-core', 'Memory management lifecycles', 'In Progress'),
        ('Captive Dependency resolution', 'dotnet-core', 'Resolving scoped from singletons', 'Not Started'),
        ('Clustered vs Non-Clustered indexing', 'sql', 'Indexes B-Tree lookups', 'Not Started'),
        ('Query SARGability checks', 'sql', 'Optimizing WHERE parameter searches', 'Not Started'),
        ('Server Actions form actions', 'react', 'React 19 forms integration', 'Not Started'),
        ('DIP vs Dependency Injection', 'design-patterns', 'Abstractions decoupling patterns', 'Not Started'),
        ('Cache stampede prevention', 'system-design', 'Mutex lock redis caching', 'Not Started')
      `);
    }

    // Pre-populate some starter notes if empty
    if (counts.NotesCount === 0) {
      console.log('Pre-populating database with default interview notes...');
      
      // Starter note 1: .NET Core DI
      await pool.request()
        .input('slug', sql.VarChar, 'dependency-injection-lifetimes')
        .input('title', sql.NVarChar, '.NET Core Dependency Injection Lifetimes')
        .input('category', sql.VarChar, 'dotnet-core')
        .input('content', sql.NVarChar, `Dependency Injection (DI) is a first-class citizen in .NET Core. Understanding the lifetimes of registered services is one of the most critical aspects of designing stable, scalable, and memory-efficient applications.

### 1. Transient
Transient services are created **each time they are requested** from the service container. This lifetime works best for lightweight, stateless services.

### 2. Scoped
Scoped services are created **once per client request** (HTTP connection request).

### 3. Singleton
Singleton services are created **once** and remain the same for the entire application lifecycle.

---

### Interview Q&As

<div class="interview-q">
<h4>Q: What is a Captive Dependency?</h4>
<strong>Answer:</strong>
Occurs when a service with a shorter lifetime (e.g. Scoped DbContext) is injected into a service with a longer lifetime (e.g. Singleton). This holds the shorter-lived service captive, causing database pool leaks.
</div>`)
        .input('tags', sql.NVarChar, '.NET Core,Architecture,Dependency Injection')
        .input('pinned', sql.Bit, 1)
        .input('favorite', sql.Bit, 1)
        .input('reading', sql.Int, 3)
        .query('INSERT INTO Notes (Slug, Title, CategorySlug, Content, Tags, Pinned, Favorite, ReadingTime) VALUES (@slug, @title, @category, @content, @tags, @pinned, @favorite, @reading)');
        
      // Starter note 2: SQL Indexing
      await pool.request()
        .input('slug', sql.VarChar, 'indexing-performance-tuning')
        .input('title', sql.NVarChar, 'SQL Indexing & Performance Tuning')
        .input('category', sql.VarChar, 'sql')
        .input('content', sql.NVarChar, `Indexes are crucial B-Tree data structures that improve the speed of data retrieval operations.

* **Clustered Index**: Restructures the physical table rows to sort them according to the key. Limit 1 per table.
* **Non-Clustered Index**: A separate structure containing key columns and pointers (RID or Clustered Key) back to the rows. Limit 999.

---

### SARGability
A query is SARGable (Search Argument Able) if the engine can perform an **Index Seek** instead of scanning.
* **SARGable**: \`WHERE OrderDate >= '2026-01-01'\`
* **Non-SARGable**: \`WHERE YEAR(OrderDate) = 2026\``)
        .input('tags', sql.NVarChar, 'SQL,Database,Performance,Tuning')
        .input('pinned', sql.Bit, 1)
        .input('favorite', sql.Bit, 0)
        .input('reading', sql.Int, 2)
        .query('INSERT INTO Notes (Slug, Title, CategorySlug, Content, Tags, Pinned, Favorite, ReadingTime) VALUES (@slug, @title, @category, @content, @tags, @pinned, @favorite, @reading)');
    }

    console.log('SQL Server database schemas verified successfully.');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
}
