import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Groq API Configuration
// ---------------------------------------------------------------------------
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

// ---------------------------------------------------------------------------
// repairJsonControlChars
// Walks raw text char-by-char, tracks inString state, and escapes illegal
// control characters (newlines, tabs, etc.) found inside JSON string values.
// ---------------------------------------------------------------------------
function repairJsonControlChars(str: string): string {
  let result   = '';
  let inString = false;
  let escaped  = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (inString && char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result   += char;
      continue;
    }

    if (inString && code < 0x20) {
      switch (code) {
        case 0x0a: result += '\\n'; break;
        case 0x0d: result += '\\r'; break;
        case 0x09: result += '\\t'; break;
        case 0x08: result += '\\b'; break;
        case 0x0c: result += '\\f'; break;
        default:
          result += '\\u' + code.toString(16).padStart(4, '0');
      }
      continue;
    }

    result += char;
  }

  return result;
}

// ---------------------------------------------------------------------------
// safeParseJson — two-pass parser with automatic control-char repair
// ---------------------------------------------------------------------------
function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (firstError: any) {
    const msg: string = firstError?.message ?? '';
    const isControlCharErr =
      msg.toLowerCase().includes('control') ||
      msg.toLowerCase().includes('bad escape') ||
      msg.toLowerCase().includes('invalid character');

    if (!isControlCharErr) throw firstError;

    console.warn('JSON parse failed with control-char error — repairing and retrying...');
    const repaired = repairJsonControlChars(text);
    return JSON.parse(repaired);
  }
}

// ---------------------------------------------------------------------------
// stripCodeFences — remove wrapping triple-backtick fences if model adds them
// ---------------------------------------------------------------------------
function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith('`')) {
    s = s.replace(/^`{3}(?:json)?\s*/i, '').replace(/\s*`{3}$/, '').trim();
  }
  return s;
}

// ---------------------------------------------------------------------------
// buildPrompts — construct prompt strings WITHOUT template literals so that
// no backtick character can accidentally close a template literal expression.
// ---------------------------------------------------------------------------
function buildPrompts(prompt: string, category: string) {
  const fence = '```';

  const systemContent = [
    'You are an expert developer and senior software engineering interviewer.',
    'Your task is to create exhaustive, high-quality technical study notes and interview preparation sheets.',
    '',
    'CRITICAL OUTPUT RULES you MUST follow:',
    '1. Respond with ONLY a single raw JSON object. No markdown code fences. No preamble. No explanation. Pure JSON.',
    '2. ALL string values in the JSON must use the two-character sequence \\n for newlines — never literal line breaks.',
    '3. Do not wrap the JSON in any markdown code fences.',
  ].join('\n');

  const contentInstruction = [
    'Full deep-dive Markdown note. Must include:',
    '1) Executive Summary paragraph.',
    '2) Core Concepts and inner mechanics explained in depth.',
    '3) Comprehensive copy-pasteable code examples with syntax highlighting using ' + fence + 'csharp, ' + fence + 'javascript, ' + fence + 'sql, ' + fence + 'typescript code blocks.',
    '4) An Interview Q&A section at the end with 3 highly technical questions, each formatted as:',
    '<div class=\\"interview-q\\"><h4>Q: [question]</h4><strong>Answer:</strong> [detailed answer]</div>',
    'Use Markdown tables, lists, and blockquotes throughout.',
  ].join('\\n');

  const userContent = [
    'Create an exhaustive technical study note and interview prep sheet for the topic: "' + prompt + '".',
    'Category: "' + category + '".',
    '',
    'Return ONLY this raw JSON object — no markdown fences, no extra text whatsoever:',
    '{',
    '  "title": "Precise professional title for the topic",',
    '  "content": "' + contentInstruction + '",',
    '  "tags": ["tag1", "tag2", "tag3"]',
    '}',
    '',
    'REMINDER: Every newline inside a JSON string value must be the two-character sequence \\n — never a literal line break.',
  ].join('\n');

  return { systemContent, userContent };
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, category } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'AI prompt is required' },
        { status: 400 }
      );
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GROQ_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    console.log('Initiating Groq note generation [' + GROQ_MODEL + '] for: "' + prompt + '"');

    const { systemContent, userContent } = buildPrompts(prompt, category || 'General');

    const apiResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user',   content: userContent   },
        ],
        temperature: 0.4,
        max_tokens:  4096,
        stream:      false,
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('Groq generate error [' + apiResponse.status + ']:', errText);
      return NextResponse.json(
        { success: false, error: 'Groq API returned error ' + apiResponse.status + ': ' + errText },
        { status: 502 }
      );
    }

    const apiData   = await apiResponse.json();
    const rawText   = apiData.choices?.[0]?.message?.content;

    if (!rawText) {
      console.error('Groq returned empty response body:', apiData);
      return NextResponse.json(
        { success: false, error: 'Groq API returned empty response. Check API key or quota.' },
        { status: 502 }
      );
    }

    // Step 1: strip markdown fences the model may have added despite instructions
    const cleanedText = stripCodeFences(rawText);

    // Step 2: two-pass safe parse (auto-repairs control chars on failure)
    try {
      const parsed = safeParseJson(cleanedText);

      if (!parsed.title || !parsed.content) {
        throw new Error('Parsed JSON is missing required "title" or "content" fields');
      }

      console.log('Groq note generation successful! Title: "' + parsed.title + '"');
      return NextResponse.json({
        success: true,
        title:   parsed.title,
        tags:    Array.isArray(parsed.tags) ? parsed.tags : ['AI Generated', category || 'General'],
        content: parsed.content,
      });

    } catch (parseError: any) {
      console.error('Failed to parse Groq response. Preview:', cleanedText.substring(0, 500), parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse Groq response as JSON: ' + parseError.message + '. Preview: ' + cleanedText.substring(0, 300),
        },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error('AI generate route crash:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
