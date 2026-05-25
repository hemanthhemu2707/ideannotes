---
title: React 19 & Server Components
category: .NET
createdDate: '2026-05-25T12:00:00.000Z'
updatedDate: '2026-05-25T18:07:34.801Z'
tags:
  - React 19
  - React
  - Next.js
  - Server Components
  - Frontend
pinned: false
favorite: true
---
# React 19 and React Server Components (RSC)

React 19 solidifies React Server Components (RSC) as an integral architectural paradigm, natively decoupling component rendering from client-side JavaScript execution. Next.js App Router relies extensively on this architecture.

## Client vs. Server Components

It is essential to understand that all components in the Next.js App Router are **Server Components by default**.

| Aspect | Server Components | Client Components (`"use client"`) |
| :--- | :--- | :--- |
| **Execution** | Runs **only on the server**. Never sent to the browser. | Rendered on the server (SSR) and hydrated/executed in the browser. |
| **JS Bundle Size** | Zero bytes of client-side JS. Reduces initial page weight. | Contributes to the client-side JavaScript bundle. |
| **Data Fetching** | Can be asynchronous (`async/await`) and fetch directly from database, filesystem, or secure APIs. | Fetches data via `useEffect` or client-side fetching libraries (SWR, React Query). |
| **Interactivity** | No hooks (`useState`, `useEffect`), no browser APIs (window, localStorage), no event listeners (`onClick`). | Fully interactive. Can use React hooks and all standard browser event handlers. |

---

## Server Actions and Form Handling in React 19

React 19 introduces built-in support for **Server Actions**, allowing you to execute server-side functions directly from user interactions in the client (like a form submission) without building a REST API endpoint.

### 1. Declaring a Server Action
You define a server action by placing the `"use server"` directive at the top of an async function.

```javascript
// app/actions.js
"use server"

export async function submitFeedback(formData) {
  const name = formData.get("name");
  const comments = formData.get("comments");
  
  if (!name || !comments) {
    return { success: false, error: "All fields are required" };
  }
  
  // Directly save to file system, database, or call external API
  console.log(`Feedback received from ${name}: ${comments}`);
  
  return { success: true };
}
```

### 2. Using it in a Client Component with `useActionState`
React 19 replaces `useFormState` with the new hook `useActionState` (formerly experimental) to manage the state of a form action.

```jsx
"use client"

import { useActionState } from "react";
import { submitFeedback } from "./actions";

export default function FeedbackForm() {
  // useActionState takes: (actionFunction, initialState)
  // returns: [state, formAction, isPending]
  const [state, formAction, isPending] = useActionState(async (prevState, formData) => {
    return await submitFeedback(formData);
  }, null);

  return (
    <form action={formAction} className="space-y-4 max-w-md bg-slate-800 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-slate-100">Submit Interview Feedback</h3>
      
      <div>
        <label className="block text-sm font-medium text-slate-300">Name</label>
        <input type="text" name="name" className="mt-1 block w-full rounded bg-slate-900 border-slate-700 text-slate-200" required />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300">Comments</label>
        <textarea name="comments" className="mt-1 block w-full rounded bg-slate-900 border-slate-700 text-slate-200" required />
      </div>

      {state && !state.success && (
        <p className="text-red-400 text-sm">{state.error}</p>
      )}

      {state && state.success && (
        <p className="text-green-400 text-sm">Feedback submitted successfully!</p>
      )}

      <button 
        type="submit" 
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium"
      >
        {isPending ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
```

---

## Essential Interview Q&As

### Q1: Does marking a component with `"use client"` mean it is ONLY rendered in the browser?
**Answer:**
No, this is a very common misconception. 

In frameworks like Next.js, Client Components are still pre-rendered on the server (Server-Side Rendering/SSR) to output a static HTML shell for SEO and fast initial paint. 
* `"use client"` acts as a boundary marker, telling the bundler that the component (and everything it imports) should be included in the client-side JavaScript bundle so it can be hydrated and become interactive in the browser.

### Q2: How can you pass data from a Server Component to a Client Component?
**Answer:**
You can pass data from a Server Component to a Client Component as standard **props**. 

However, since this data crosses the network boundary (from the server environment to the client bundle), the props must be **serializable**.
* **Allowed**: Strings, numbers, booleans, objects, arrays, and standard Promises.
* **NOT Allowed**: Functions, class instances, or database connections.
