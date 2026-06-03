import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Offline Heuristic Replies — shown when Groq API is unreachable/rate-limited
// ---------------------------------------------------------------------------
const OFFLINE_REPLIES: Record<string, string> = {
  'dotnet': `⚡ **[Offline Architect Mode Active]**
Groq AI is temporarily unavailable. Here is a senior-level review of **.NET Core DI Lifetimes & Architecture**:

### 1. Lifetime Comparison Grid
| Lifetime | Resolution Behavior | Best Use Case | Risk Factor |
| :--- | :--- | :--- | :--- |
| **Transient** | Created every time requested | Lightweight, stateless utilities | High allocation inside hot loops |
| **Scoped** | Created once per HTTP request | Transactional ops (e.g. \`DbContext\`) | Captive Dependency if injected into Singletons |
| **Singleton** | Created once per app lifecycle | Config, memory cache, hot instances | State concurrency bugs, resource leaks |

### 2. Resolving Scoped Services in Singletons
Safely resolve a scoped \`DbContext\` inside a background Singleton via a nested scope:

\`\`\`csharp
public class QueueProcessor : BackgroundService
{
    private readonly IServiceProvider _sp;
    public QueueProcessor(IServiceProvider sp) => _sp = sp;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            using var scope = _sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MyDbContext>();
            await db.ProcessPendingQueueAsync();
            await Task.Delay(5000, ct);
        }
    }
}
\`\`\`

*Tip: Add your \`GROQ_API_KEY\` in \`.env\` or Vercel to unlock live Llama 3.3 70B responses!*`,

  'sql': `💾 **[Offline Database Mode Active]**
Groq AI is temporarily unavailable. Here is a senior-level guide to **SQL Indexing & Performance Tuning**:

### 1. Clustered vs Non-Clustered Index
- **Clustered**: Physically sorts table rows on disk. Only one per table. Pick a dense, sequential key (\`BIGINT IDENTITY\`).
- **Non-Clustered**: Separate lookup structure with a pointer back to the heap/clustered row.

### 2. SARGability — Making Queries Index-Friendly
| ❌ Non-SARGable (Full Scan) | ✅ SARGable (Index Seek) |
| :--- | :--- |
| \`WHERE YEAR(CreatedDate) = 2026\` | \`WHERE CreatedDate >= '2026-01-01' AND CreatedDate < '2027-01-01'\` |
| \`WHERE SUBSTRING(Title,1,5) = 'React'\` | \`WHERE Title LIKE 'React%'\` |

*Tip: Add your \`GROQ_API_KEY\` in \`.env\` or Vercel to unlock live Llama 3.3 70B responses!*`,

  'react': `⚛️ **[Offline React Mode Active]**
Groq AI is temporarily unavailable. Here is a curated guide to **React Server Components & Next.js Architecture**:

### RSC vs Client Components
- **Server Components**: Zero JS bundle impact, direct DB/secret access, no hooks.
- **Client Components**: \`'use client'\` directive, supports state, effects, and DOM events.

### React 19 Server Actions
\`\`\`tsx
'use server';
export async function submitComment(formData: FormData) {
  const author = formData.get('author');
  const comment = formData.get('comment');
  await db.insertComment({ author, comment }); // Direct secure DB write!
}
\`\`\`

*Tip: Add your \`GROQ_API_KEY\` in \`.env\` or Vercel to unlock live Llama 3.3 70B responses!*`,

  'system-design': `🌐 **[Offline System Design Mode Active]**
Groq AI is temporarily unavailable. Here is a senior-level overview of **Distributed Caching & Cache Stampede Prevention**:

### Cache Stampede (Thundering Herd)
When a popular key expires, thousands of concurrent requests race to rebuild it — crashing your database.

### Distributed Mutex Lock Solution
\`\`\`javascript
async function getCachedData(key) {
  let val = await redis.get(key);
  if (!val) {
    const lock = await acquireLock(key + '_lock', 5000); // 5s TTL lock
    if (lock) {
      try {
        val = await fetchFromDatabase();
        await redis.set(key, val, 'EX', 3600);
      } finally { await releaseLock(lock); }
    } else {
      await sleep(100); // Another worker is rebuilding
      return getCachedData(key);
    }
  }
  return val;
}
\`\`\`

*Tip: Add your \`GROQ_API_KEY\` in \`.env\` or Vercel to unlock live Llama 3.3 70B responses!*`,

  'General': `🚀 **[Offline Heuristic Mode Active]**
Groq Cloud AI is temporarily unavailable or the API key has reached its rate limit.

### What is Groq?
Groq runs open-source LLMs (like Meta's **Llama 3.3 70B**) at extremely fast inference speed using custom LPU hardware — completely free for standard use!

### How to configure your key:
1. Go to [console.groq.com](https://console.groq.com) → **API Keys** → Create new key
2. Add it locally in \`.env\`:
   \`\`\`bash
   GROQ_API_KEY=gsk_your_key_here
   \`\`\`
3. On Vercel: **Project Settings → Environment Variables → Add \`GROQ_API_KEY\`**

Select a topic chip (C#, SQL, React, System Design) above to see expert offline notes while you wait!`
};

// ---------------------------------------------------------------------------
// Groq API Configuration
// ---------------------------------------------------------------------------
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Best free model: llama-3.3-70b-versatile — 128K context, extremely fast on Groq LPU
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function POST(request: Request) {
  let topic = 'General';
  try {
    // 1. Enforce Authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt, history, topic: bodyTopic } = body;
    if (bodyTopic) topic = bodyTopic;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'User prompt is required' }, { status: 400 });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not configured. Falling back to offline mode.');
      const text = OFFLINE_REPLIES[topic] || OFFLINE_REPLIES['General'];
      return NextResponse.json({ success: true, text });
    }

    // 2. System Instruction — Senior Architect / Interviewer persona
    const systemContent = `You are "DevNotes AI Doubt Solver" — an elite Senior Software Architect, Lead Mentor, and Technical Interviewer.
You are helping a highly driven software developer with their technical study doubts.

Topic Context: ${topic || 'General Software Engineering / System Design'}

Core Directives:
1. Deliver extremely thorough, conversational, and deeply professional senior-level answers.
2. Provide concrete, modern, production-grade copy-pasteable code examples with proper syntax highlighting blocks (e.g. \`\`\`csharp, \`\`\`javascript, \`\`\`sql).
3. Outline architectural trade-offs, performance implications, memory patterns, or design pattern recommendations where relevant.
4. Keep your tone encouraging, collaborative, and authoritative — be a brilliant mentor.
5. Format responses in clean, well-structured Markdown.`;

    // 3. Build OpenAI-compatible messages array
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemContent }
    ];

    // Map client-side history to Groq format
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role && msg.text) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
          });
        }
      }
    }

    // Add current user prompt
    messages.push({ role: 'user', content: prompt });

    console.log(`Initiating Groq Chat API request [${GROQ_MODEL}]. History depth: ${messages.length - 2}`);

    const apiResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        stream: false
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(`Groq Chat API error [${apiResponse.status}]:`, errText);

      // Rate-limited or auth error → graceful offline fallback
      if ([401, 403, 429].includes(apiResponse.status)) {
        console.log(`Groq API returned ${apiResponse.status}. Activating Offline Heuristic Mode.`);
        let prefix = '';
        if (apiResponse.status === 429) {
          prefix = `⚠️ **[Rate Limit Hit (429)]**\nGroq's free-tier rate limit has been temporarily reached. Activating **Offline Heuristic Mode** to keep your revision going!\n\n`;
        }
        const text = prefix + (OFFLINE_REPLIES[topic] || OFFLINE_REPLIES['General']);
        return NextResponse.json({ success: true, text });
      }

      return NextResponse.json(
        { success: false, error: `Doubt Solver API error (${apiResponse.status}). Please try again.` },
        { status: 502 }
      );
    }

    const apiData = await apiResponse.json();
    // Groq uses OpenAI-compatible response: choices[0].message.content
    const responseText = apiData.choices?.[0]?.message?.content;

    if (!responseText) {
      console.error('Groq Chat API returned empty content:', apiData);
      return NextResponse.json(
        { success: false, error: 'Empty response from Groq AI engine.' },
        { status: 502 }
      );
    }

    console.log(`Groq [${GROQ_MODEL}] responded successfully!`);
    return NextResponse.json({ success: true, text: responseText });

  } catch (error: any) {
    console.error('Doubt Solver API crash:', error);

    const errStr = String(error.message || '').toLowerCase();
    const isNetworkError = ['fetch failed', 'enotfound', 'econnrefused', 'connect'].some(s => errStr.includes(s));

    if (isNetworkError) {
      console.log('Network error detected. Activating Offline Heuristic Mode.');
      const text = OFFLINE_REPLIES[topic] || OFFLINE_REPLIES['General'];
      return NextResponse.json({ success: true, text });
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
