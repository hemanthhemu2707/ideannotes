---
title: Scaling APIs & Distributed Caching
category: .NET
createdDate: '2026-05-25T12:00:00.000Z'
updatedDate: '2026-05-25T18:07:17.530Z'
tags:
  - System Design
  - Caching
  - Redis
  - APIs
  - Scalability
pinned: false
favorite: false
---
# Scaling APIs and Distributed Caching

When scaling web APIs from thousands to millions of requests, caching is the single most effective tool to reduce read latency, lower database load, and improve overall system throughput.

---

## Caching Topologies

There are two primary ways to design caching layers:

### 1. In-Memory Local Cache
The cache is stored directly in the application server's process memory (e.g., `IMemoryCache` in .NET, local JavaScript objects).
* **Pros**: Extremely fast (no network hop).
* **Cons**: Consumes server memory; caches are isolated per server instance, which leads to **cache inconsistency** across a horizontally scaled server pool.

### 2. Distributed Cache
The cache is stored in a dedicated, external shared database cluster (e.g., **Redis**, **Memcached**).
* **Pros**: Scalable independent of servers; all app servers share the exact same consistent data; state is preserved during server restarts.
* **Cons**: Requires a network roundtrip (1-5ms extra latency).

---

## Caching Patterns & Strategies

```text
               --- [ Cache-Aside Flow ] ---
               
                 1. Check Cache
  [Client] -------------------------> [Cache (Redis)]
     |                                    |
     |                                    | 2. Cache Miss!
     |                                    v
     +-------------------------------> [Database]
                 3. Read DB & Write Cache
```

### 1. Cache-Aside (Lazy Loading)
The application acts as the orchestrator:
1. Try to read from the cache.
2. **Cache Hit**: Return the cached data.
3. **Cache Miss**: Query the database, store the result in the cache, and return the data.

* **Pros**: Cache only stores data that is actually requested; DB failure is tolerated (fails back to slow reads).
* **Cons**: Three-step latency on a cache miss; stale data can persist if cache invalidation is not managed.

### 2. Write-Through
Data is written to the cache and the database **simultaneously** inside a transaction.
* **Pros**: Data in the cache is never stale; fast subsequent reads.
* **Cons**: High write latency because you write to two systems; resources are wasted on data that might never be read again.

### 3. Write-Behind (Write-Back)
The application writes data to the cache immediately, which returns success. A separate background job asynchronously syncs the data back to the database.
* **Pros**: Incredibly fast writes (ideal for write-heavy logging or gaming scores).
* **Cons**: Risk of data loss if the cache server crashes before the background sync completes.

---

## Essential Interview Q&As

### Q1: What are Cache Avalanche and Cache Stampede, and how do you prevent them?
**Answer:**
#### Cache Avalanche
* **What it is**: Occurs when many cache keys expire at the **exact same time**, causing a sudden massive surge of queries to hit the database simultaneously, potentially crashing it.
* **Mitigation**: Add a **random jitter** (e.g., a random offset of 1 to 5 minutes) to the expiration time (TTL) of each key so that they don't expire in a single coordinated wave.

#### Cache Stampede (Thundering Herd)
* **What it is**: Occurs when an extremely high-traffic key (e.g., homepage layout data) expires. Multiple concurrent server threads detect the cache miss at the exact same moment and all run the identical expensive database query simultaneously.
* **Mitigation**: Use **Mutex Locking** (distributed locks) or double-check locking during cache misses, or use background threads to proactively refresh hot keys *before* they expire.

```csharp
// Simple Mutex lock mitigation for Cache Stampede
public async Task<string> GetUserDataAsync(string key)
{
    var data = await _cache.GetStringAsync(key);
    if (data == null)
    {
        // Acquire lock
        lock (_lockObject)
        {
            data = _cache.GetString(key); // Double check
            if (data == null)
            {
                data = FetchFromDatabase();
                _cache.SetString(key, data, TimeSpan.FromMinutes(10));
            }
        }
    }
    return data;
}
```

### Q2: What Cache Eviction Policies are commonly used in Redis?
**Answer:**
When Redis memory limit is reached, it evicts keys based on configured policies:
1. **LRU (Least Recently Used)**: Evicts keys that haven't been requested for the longest time. Ideal for normal traffic patterns.
2. **LFU (Least Frequently Used)**: Evicts keys that are requested the least number of times overall, regardless of recency. Ideal to keep hot keys cached.
3. **FIFO (First In First Out)**: Evicts the oldest keys first.
4. **Random**: Evicts random keys to free up space.
