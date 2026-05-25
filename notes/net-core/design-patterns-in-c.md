---
title: Design Patterns in C#
category: .NET Core
createdDate: '2026-05-25T12:00:00.000Z'
updatedDate: '2026-05-25T18:06:40.070Z'
tags:
  - C#
  - .NET
  - Design Patterns
  - Software Engineering
  - OOP
pinned: false
favorite: true
---
# Creational and Structural Design Patterns in C#

Design patterns are reusable solutions to common software design problems. In interview scenarios, implementing patterns that are thread-safe and align with modern dependency injection (DI) principles is highly valued.

---

## 1. The Singleton Pattern (Creational)

The Singleton pattern ensures that a class has only one instance and provides a global point of access to it.

### Thread-Safe C# Implementation (Lazy Initialization)
Modern C# uses the `Lazy<T>` type to guarantee thread-safe, deferred initialization out-of-the-box without requiring explicit double-check locking boilerplate.

```csharp
using System;

public sealed class CacheManager
{
    // Lazy<T> handles thread-safety implicitly under the hood
    private static readonly Lazy<CacheManager> _instance = 
        new Lazy<CacheManager>(() => new CacheManager());

    // Private constructor prevents external instantiation
    private CacheManager()
    {
        Console.WriteLine("CacheManager Initialized.");
    }

    public static CacheManager Instance => _instance.Value;

    public void Set(string key, object value)
    {
        // Cache storage logic
    }
}
```

---

## 2. The Factory Method Pattern (Creational)

The Factory Method pattern defines an interface for creating an object but lets subclasses decide which class to instantiate.

### C# Implementation
Suppose we want to build a notification delivery service supporting Email and SMS.

```csharp
// Product
public interface INotification
{
    void Send(string message);
}

// Concrete Products
public class EmailNotification : INotification
{
    public void Send(string message) => Console.WriteLine($"Email sent: {message}");
}

public class SmsNotification : INotification
{
    public void Send(string message) => Console.WriteLine($"SMS sent: {message}");
}

// Creator
public abstract class NotificationFactory
{
    public abstract INotification CreateNotification();
}

// Concrete Creators
public class EmailNotificationFactory : NotificationFactory
{
    public override INotification CreateNotification() => new EmailNotification();
}

public class SmsNotificationFactory : NotificationFactory
{
    public override INotification CreateNotification() => new SmsNotification();
}
```

---

## 3. The Decorator Pattern (Structural)

The Decorator pattern dynamically attaches additional responsibilities to an object. Decorators provide a flexible alternative to subclassing for extending functionality.

### C# Implementation (Adding Logging to a Repository)
A common real-world application of the Decorator pattern is adding cross-cutting concerns (logging, caching, auditing) to database operations without polluting the business logic.

```csharp
// Component Interface
public interface IOrderService
{
    void ProcessOrder(int orderId);
}

// Concrete Component
public class OrderService : IOrderService
{
    public void ProcessOrder(int orderId)
    {
        Console.WriteLine($"Processing order #{orderId} in DB...");
    }
}

// Decorator Base
public abstract class OrderServiceDecorator : IOrderService
{
    protected readonly IOrderService _innerService;

    protected OrderServiceDecorator(IOrderService innerService)
    {
        _innerService = innerService;
    }

    public virtual void ProcessOrder(int orderId)
    {
        _innerService.ProcessOrder(orderId);
    }
}

// Concrete Decorator (Logging Decorator)
public class LoggingOrderServiceDecorator : OrderServiceDecorator
{
    public LoggingOrderServiceDecorator(IOrderService innerService) : base(innerService) { }

    public override void ProcessOrder(int orderId)
    {
        Console.WriteLine($"[LOG] Starting order #{orderId} processing...");
        
        base.ProcessOrder(orderId); // Call inner component
        
        Console.WriteLine($"[LOG] Completed order #{orderId} processing.");
    }
}
```

---

## Essential Interview Q&As

### Q1: How do you register a Decorator in the .NET Core Dependency Injection Container?
**Answer:**
Historically, registering decorators in the built-in DI required manual factory functions or third-party libraries (like Scrutor).

However, in **.NET 8+**, you can use **Keyed Services** to elegantly hook up the Decorator pattern:

```csharp
var builder = WebApplication.CreateBuilder(args);

// Register the raw implementation with a key
builder.Services.AddKeyedTransient<IOrderService, OrderService>("rawOrderService");

// Register the decorator, injecting the keyed raw service into its constructor
builder.Services.AddTransient<IOrderService>(sp => 
    new LoggingOrderServiceDecorator(
        sp.GetRequiredKeyedService<IOrderService>("rawOrderService")
    )
);
```

### Q2: Why should you avoid the classic Double-Check Locking Singleton in modern C#?
**Answer:**
The classic double-check locking pattern is verbose, prone to subtle memory barrier bugs if the volatile keyword is missing, and hard to read:

```csharp
// Verbose and bug-prone old approach
if (_instance == null) {
    lock (_lock) {
        if (_instance == null) {
            _instance = new CacheManager();
        }
    }
}
```

Instead, modern C# relies on `Lazy<T>`, which uses a standard internal lock-free or double-lock thread-safety protocol, is highly optimized, and uses clean declarative code that is easier to maintain and audit.
