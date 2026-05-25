import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const OFFLINE_REPLIES: Record<string, string> = {
  'dotnet': `⚡ **[Sandbox Offline Architect Mode Active]**
It seems the local development sandbox has restricted DNS outbound access to Google Gemini, or the pre-loaded API key has been security-revoked (403) by Google. Here is a senior-level review of **.NET Core DI Lifetimes & Architecture**:

### 1. Lifetime Comparison Grid
| Lifetime | Resolution Behavior | Best Use Case | Risk Factor |
| :--- | :--- | :--- | :--- |
| **Transient** | Created every time requested | Lightweight, stateless utilities | High allocation if instantiated inside hot loops |
| **Scoped** | Created once per HTTP connection request | Transactional operations (e.g. SQL \`DbContext\`) | Captive Dependency if injected into Singletons |
| **Singleton** | Created once per application cycle | Configuration, memory cache, hot instances | State concurrency bugs, resource leaks |

### 2. Resolving Scoped Services in Singletons
To safely resolve a scoped DbContext inside a background Singleton service (like an \`IHostedService\`), inject \`IServiceProvider\` and resolve it dynamically via a nested scope:

\`\`\`csharp
public class QueueProcessor : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;

    public QueueProcessor(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<MyDbContext>();
                await dbContext.ProcessPendingQueueAsync();
            }
            await Task.Delay(5000, stoppingToken);
        }
    }
}
\`\`\`

*Note: Configure your own secret \`GEMINI_API_KEY\` locally in \`.env\` or on Vercel to unlock live Gemini responses!*`,

  'sql': `💾 **[Sandbox Offline Database Mode Active]**
It seems the local development sandbox has restricted DNS outbound access to Google Gemini, or the pre-loaded API key has been security-revoked (403) by Google. Here is a senior-level guide to **SQL Indexing & Performance Tuning**:

### 1. B-Tree Structure Breakdown
- **Clustered Index**: Restructures the physical table data rows on disk in sorting sequence based on the index key. Always choose a dense, sequential column (like \`BIGINT IDENTITY\`).
- **Non-Clustered Index**: A separate pointer grid. Stores the index key columns and a locator pointing to the physical row.

### 2. SARGability Checks (Sufficient Search Argument)
A query is SARGable if the optimizer can perform a fast **Index Seek** instead of a full **Index Scan**:

- ❌ **Non-SARGable (Avoid)**:
  \`\`\`sql
  SELECT Id, Title FROM Notes WHERE YEAR(CreatedDate) = 2026;
  SELECT Id, Title FROM Notes WHERE SUBSTRING(Title, 1, 5) = 'React';
  \`\`\`
-  **SARGable (Recommended)**:
  \`\`\`sql
  SELECT Id, Title FROM Notes WHERE CreatedDate >= '2026-01-01' AND CreatedDate < '2027-01-01';
  SELECT Id, Title FROM Notes WHERE Title LIKE 'React%';
  \`\`\`

*Note: Configure your own secret \`GEMINI_API_KEY\` locally in \`.env\` or on Vercel to unlock live Gemini responses!*`,

  'react': `⚛️ **[Sandbox Offline React Mode Active]**
It seems the local development sandbox has restricted DNS outbound access to Google Gemini, or the pre-loaded API key has been security-revoked (403) by Google. Here is a curated guide to **React 19 & Next.js 15 Server-Side Architecture**:

### 1. React Server Components (RSC) vs Client Components (\`'use client'\`)
- **Server Components (RSC)**: 
  - Render entirely on the server.
  - Zero impact on client-side JS bundle weight.
  - Direct secure access to databases, filesystems, and API keys.
  - ❌ Cannot use state (\`useState\`), context (\`useContext\`), or browser-only hooks (\`useEffect\`).
- **Client Components**:
  - Defined with the \`'use client'\` directive at the top of the file.
  - Hydrate on the browser.
  - Support interactivity, state, and client-side DOM events.

### 2. React 19 Server Actions Form Submission
Avoid writing complex API endpoints to post standard form data. Execute them directly via server actions:

\`\`\`tsx
// actions.ts
'use server';

export async function submitComment(formData: FormData) {
  const author = formData.get('author');
  const comment = formData.get('comment');
  
  // Directly write to database securely from server context!
  await db.insertComment({ author, comment });
}
\`\`\`

*Note: Configure your own secret \`GEMINI_API_KEY\` locally in \`.env\` or on Vercel to unlock live Gemini responses!*`,

  'system-design': `🌐 **[Sandbox Offline System Design Mode Active]**
It seems the local development sandbox has restricted DNS outbound access to Google Gemini, or the pre-loaded API key has been security-revoked (403) by Google. Here is a senior-level overview of **Distributed Caching & Stampede Prevention**:

### 1. Cache Stampede (Thundering Herd)
Occurs when a highly popular key (e.g. home page data) expires from the cache under extreme traffic load. Thousands of concurrent HTTP requests hit the backend simultaneously, crashing the database.

### 2. Distributed Mutex Lock Solution
Use a lightweight lock (such as Redis Redlock) so only the *first* thread recalculates the value while others wait:

\`\`\`javascript
async function getCachedData(key) {
  let val = await redis.get(key);
  if (!val) {
    // Acquire a distributed lock valid for 5 seconds
    const lock = await acquireLock(key + '_lock', 5000);
    if (lock) {
      try {
        val = await fetchFromSQLDatabase();
        await redis.set(key, val, 'EX', 3600);
      } finally {
        await releaseLock(lock);
      }
    } else {
      // Lock not acquired: wait briefly and retry
      await sleep(100);
      return getCachedData(key);
    }
  }
  return val;
}
\`\`\`

*Note: Configure your own secret \`GEMINI_API_KEY\` locally in \`.env\` or on Vercel to unlock live Gemini responses!*`,

  'General': `🚀 **[Sandbox Offline Architect Mode Active]**
It seems the local development sandbox has restricted DNS outbound access to Google Gemini, or the pre-loaded API key has been security-revoked (403) by Google.

However, the **DevNotes Doubt Solver** has gracefully detected this environment restriction and is operating in **Offline Heuristic Mode**!

### How to set up your own secret API Key:
1. **Get your own key**: Go to [Google AI Studio](https://aistudio.google.com/) and request a free Gemini API key.
2. **Add Locally**: Create a file named \`.env\` in your project root and add your key:
   \`\`\`bash
   GEMINI_API_KEY=your_actual_api_key_here
   \`\`\`
   *(The \`.env\` file is already listed in your \`.gitignore\`, so it won't be pushed to public GitHub).*
3. **Add on Vercel**: Go to your Vercel Project settings, navigate to **Environment Variables**, and add \`GEMINI_API_KEY\` with your private key!
4. **Change Topic Filter**: Select C#, SQL, React, or System Design in the chips above to view curated, high-fidelity offline architectural templates and code snippets!

Feel free to continue asking questions, or write a doubt topic to test! Let me know how I can guide your learning.`
};

export async function POST(request: Request) {
  let topic = 'General';
  try {
    // 1. Enforce Authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, history, topic: bodyTopic } = body;
    if (bodyTopic) {
      topic = bodyTopic;
    }

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'User prompt is required' }, { status: 400 });
    }

    // 2. Resolve Gemini API Endpoint
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // 3. Assemble Conversational History into Gemini Format
    const contents: any[] = [];

    // Map client-side history to Gemini's { role: 'user' | 'model', parts: [{ text }] } structure
    if (Array.isArray(history)) {
      history.forEach((msg: any) => {
        if (msg.role && msg.text) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        }
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    // System instruction defining the Senior Architect/Interviewer persona
    const systemPromptText = `You are "DevNotes AI Doubt Solver" — an elite Senior Software Architect, Lead Mentor, and Technical Interviewer.
You are helping a highly driven software developer with their technical study doubts.

Topic Context: ${topic || 'General Software Engineering / System Design'}

Core Directives:
1. Deliver extremely thorough, conversational, and deeply professional senior-level answers.
2. Provide concrete, modern, production-grade copy-pasteable code examples using best practices (with proper syntax highlight blocks like \`\`\`csharp, \`\`\`javascript, \`\`\`sql).
3. If relevant, outline architectural trade-offs, performance implications, memory patterns, or design pattern recommendations.
4. Keep your tone encouraging, collaborative, and authoritative. Be a brilliant mentor.`;

    const requestBody = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPromptText }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    console.log(`Initiating Gemini Chat API request. History depth: ${contents.length - 1}`);

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('Gemini Chat API returned status error:', apiResponse.status, errText);
      
      // If the API key is restricted, revoked, or rate-limited (403/401/429), trigger Heuristic offline mode!
      if (apiResponse.status === 403 || apiResponse.status === 401 || apiResponse.status === 429) {
        console.log(`Gemini API key returned status ${apiResponse.status}. Activating Offline Heuristic Mode fallback.`);
        const topicKey = topic || 'General';
        
        let prefix = '';
        if (apiResponse.status === 429) {
          prefix = `⚠️ **[Free Tier Rate Limit Exceeded (429)]**\nYou have temporarily hit Google's Gemini free-tier rate limit of 15 requests per minute. The Doubt Solver has automatically activated **Offline Heuristic Mode** to keep your revision active with expert pre-loaded architecture notes!\n\n`;
        }
        
        const text = prefix + (OFFLINE_REPLIES[topicKey] || OFFLINE_REPLIES['General']);
        return NextResponse.json({ success: true, text });
      }

      return NextResponse.json({ 
        success: false, 
        error: `Doubt Solver API error (${apiResponse.status}). Please try again.` 
      }, { status: 502 });
    }

    const apiData = await apiResponse.json();
    const responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error('Gemini Chat API returned empty content candidate structure:', apiData);
      return NextResponse.json({ 
        success: false, 
        error: 'Empty response candidate structure from AI engine.' 
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      text: responseText
    });
  } catch (error: any) {
    console.error('Doubt Solver API crash:', error);
    
    const errString = String(error.message || '').toLowerCase();
    const isNetworkError = errString.includes('fetch failed') || 
                          errString.includes('enotfound') || 
                          errString.includes('econnrefused') || 
                          errString.includes('connect');

    if (isNetworkError) {
      console.log('Restricted local sandbox environment detected. Activating Offline Heuristic Mode fallback.');
      const topicKey = topic || 'General';
      const text = OFFLINE_REPLIES[topicKey] || OFFLINE_REPLIES['General'];

      return NextResponse.json({
        success: true,
        text
      });
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
