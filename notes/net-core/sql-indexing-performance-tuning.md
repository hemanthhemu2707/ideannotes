---
title: SQL Indexing & Performance Tuning
category: .NET Core
createdDate: '2026-05-25T12:00:00.000Z'
updatedDate: '2026-05-25T18:08:20.752Z'
tags:
  - SQL
  - Database
  - Performance Tuning
  - Query Optimization
pinned: true
favorite: false
---
# SQL Indexing and Performance Tuning

Indexes are crucial for database performance. An index is a data structure (typically a B-Tree) that improves the speed of data retrieval operations on a table at the cost of slower writes and additional storage space.

## Clustered vs. Non-Clustered Indexes

| Characteristic | Clustered Index | Non-Clustered Index |
| :--- | :--- | :--- |
| **Physical Storage** | Dictates the actual physical sort order of the rows in the table. | Maintained in a separate structure; does not rearrange the table itself. |
| **Pointers** | Leaf nodes contain the actual data pages (table rows). | Leaf nodes contain pointers/row locators (RID or Clustered Key) back to the data. |
| **Limit per Table** | Exactly 1 per table (because data can only be physically sorted one way). | Up to 999 per table (in SQL Server). |
| **Default Creation** | Automatically created when a `PRIMARY KEY` constraint is defined. | Can be added manually or automatically on `UNIQUE` constraints. |

---

## B-Tree Structure Visualized

```text
                     [ Root Node ]
                     /           \
           [ Intermediate ]     [ Intermediate ]
            /          \          /          \
       [Leaf Node] [Leaf Node] [Leaf Node] [Leaf Node]
      (Contains actual data rows   (Contains Index keys +
       for Clustered Indexes)       pointers back to the rows)
```

---

## Performance Tuning Best Practices

### 1. Avoid Index Scans, Aim for Index Seeks
* **Index Seek**: The database engine uses the B-Tree structure to jump directly to the matching rows. This is extremely efficient ($O(\log N)$).
* **Index Scan**: The engine reads the entire index structure leaf-by-leaf. If the table is large, this behaves similarly to a Table Scan ($O(N)$) and can cause high disk I/O.

### 2. The Power of Covering Indexes (with `INCLUDE`)
If a query requires columns that are not in the index key, the database must perform a "Key Lookup" or "RID Lookup" to fetch the remaining columns from the table. If you have many lookups, it is faster to include those extra columns in the index itself!

```sql
-- Creating a covering index
CREATE NONCLUSTERED INDEX IX_Employees_DepartmentID
ON Employees (DepartmentID)
INCLUDE (FirstName, LastName, Salary);
```
*When executing `SELECT FirstName, LastName, Salary FROM Employees WHERE DepartmentID = 5`, the engine satisfies the query entirely from the index leaf nodes without visiting the base table!*

---

## Essential Interview Q&As

### Q1: What is SARGability, and why does it matter?
**Answer:**
**SARGable** stands for *Search Argument Able*. A query is SARGable if the database engine can utilize an index seek on the column in the `WHERE` clause. 

If you apply functions, math, or string operations directly to the indexed column in a filter, the database is forced to evaluate it for every row, resulting in an **Index Scan** instead of an **Index Seek**.

#### Non-SARGable Query (Bad):
```sql
SELECT OrderID, OrderDate 
FROM Orders 
WHERE YEAR(OrderDate) = 2026;
```

#### SARGable Equivalent (Good):
```sql
SELECT OrderID, OrderDate 
FROM Orders 
WHERE OrderDate >= '2026-01-01' AND OrderDate < '2027-01-01';
```

### Q2: What is the difference between a Key Lookup and a RID Lookup?
**Answer:**
Both lookups occur when a Non-Clustered index seek succeeds, but the query requires additional columns that are not part of the index.
* **RID Lookup**: Occurs when the underlying table is a **Heap** (has no clustered index). The lookup pointer is a physical Row ID (file, page, slot).
* **Key Lookup**: Occurs when the underlying table has a **Clustered Index**. The lookup pointer is the Clustered Index Key. The database must traverse the Clustered B-Tree to find the row.

Both of these are expensive operations. If a query is run frequently and causes lookups, create a **Covering Index** using the `INCLUDE` clause.
