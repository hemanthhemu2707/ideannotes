---
title: .NET Core Dependency Injection Lifetimes
category: .NET
createdDate: '2026-05-25T12:00:00.000Z'
updatedDate: '2026-05-25T18:06:56.677Z'
tags:
  - .NET Core
  - Architecture
  - Dependency Injection
  - Interview Prep
pinned: true
favorite: true
---
# Dependency Injection Lifetimes in .NET Core

Dependency Injection (DI) is a first-class citizen in .NET Core. Understanding the lifetimes of registered services is one of the most critical aspects of designing stable, scalable, and memory-efficient applications.

## Core Concepts

There are three primary service lifetimes provided by the built-in .NET IoC container:

### 1. Transient (`AddTransient`)
Transient services are created **each time they are requested** from the service container. This lifetime works best for lightweight, stateless services.

* **Instantiation**: A new instance is created every single time a class constructor requests it, or when calling `ServiceProvider.GetService()`.
* **Use Case**: Helper classes, mathematical utilities, mapper services.

### 2. Scoped (`AddScoped`)
Scoped services are created **once per client request (connection)** or per lifetime scope.

* **Instantiation**: In a web application, a new instance is created once per HTTP request. All components that request a scoped dependency within the same HTTP request will share that identical instance.
* **Use Case**: Entity Framework Database Contexts (`DbContext`), repository classes, stateful transaction handlers.

### 3. Singleton (`AddSingleton`)
Singleton services are created **the first time they are requested** (or when `ConfigureServices` is run if you specify an instance) and remain the same across all subsequent requests.

* **Instantiation**: A single instance is created once and lives for the entire lifetime of the application process.
* **Use Case**: Caching services, configuration settings, logging providers, hardware interfaces.

---

## Code Example: Lifetime Visualization

To understand how these lifetimes behave under the hood, let's look at an implementation that tracks unique GUIDs for each service type.

```csharp
using System;

namespace InterviewPrep.Services
{
    public interface IOperation
    {
        Guid OperationId { get; }
    }

    public interface ITransientOperation : IOperation { }
    public interface IScopedOperation : IOperation { }
    public interface ISingletonOperation : IOperation { }

    public class Operation : ITransientOperation, IScopedOperation, ISingletonOperation
    {
        public Guid OperationId { get; } = Guid.NewGuid();
    }
}
```

### Registration in `Program.cs` (.NET 6+)

```csharp
using InterviewPrep.Services;

var builder = WebApplication.CreateBuilder(args);

// Registering operations with different lifetimes
builder.Services.AddTransient<ITransientOperation, Operation>();
builder.Services.AddScoped<IScopedOperation, Operation>();
builder.Services.AddSingleton<ISingletonOperation, Operation>();

var app = builder.Build();
```

---

## Essential Interview Q&As

### Q1: What is the Captive Dependency problem?
**Answer:**
A **Captive Dependency** occurs when a service with a shorter lifetime is injected into a service with a longer lifetime. For example, if you inject a **Scoped** service (like a `DbContext`) into a **Singleton** service, the Scoped service is *held captive* by the Singleton. 

Because the Singleton lives forever, the Scoped service will also live forever. This can lead to database connection pool exhaustion, memory leaks, and concurrency bugs, as database contexts are not thread-safe.

* **Detection**: Modern .NET Core has built-in validation. In Development environment, it throws an `InvalidOperationException` if a scoped service is resolved from a singleton.
* **Solution**: Use `IServiceScopeFactory` to manually create a temporary scope inside the Singleton when you need to use the scoped dependency.

```csharp
public class MySingletonService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public MySingletonService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    public void DoWork()
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<MyDbContext>();
            // Work with the DbContext safely inside this local scope
        }
    }
}
```

### Q2: Are Singleton services thread-safe?
**Answer:**
No. The IoC container only guarantees that a single instance is shared. It is the developer's responsibility to make sure the implementation is thread-safe. Avoid mutating shared state without locks or thread-safe primitives (like `ConcurrentDictionary` or `SemaphoreSlim`).
