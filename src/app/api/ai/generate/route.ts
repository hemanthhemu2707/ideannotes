import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, category } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'AI prompt is required' }, { status: 400 });
    }

    // Attempt Real Gemini API Generation using the user's key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    console.log('Initiating Gemini API call for prompt:', prompt);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const promptText = `You are an expert developer and senior software engineering interviewer.
Create an exhaustive, high-quality technical study note and interview preparation sheet for the topic: "${prompt}".
The note belongs to the category: "${category || 'General'}".

Generate deep, comprehensive Markdown content. Do NOT use simple summaries or placeholder text. Your notes must feel extremely premium, complete, and educational.

Format your entire response as a JSON object matching this schema EXACTLY:
{
  "title": "A precise, professional title for the topic (e.g. '.NET Garbage Collection & Memory Management')",
  "content": "Deep technical note in high-quality Markdown format. It must include: 1) Executive Summary. 2) Core concepts and inner mechanics explained clearly. 3) Comprehensive, copy-pasteable code examples with detailed code syntax highlighting (like csharp, javascript, or sql code blocks) demonstrating best practices. 4) A dedicated 'Essential Interview Q&As' section at the end containing 3 highly technical interview questions formatted inside '<div class=\"interview-q\"><h4>Q: ...</h4><strong>Answer:</strong> ...</div>' cards. Use standard Markdown formatting like tables, lists, and quotes.",
  "tags": ["3 to 5 highly relevant technical tags for indexing"]
}`;

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: promptText
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              tags: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["title", "content", "tags"]
          }
        }
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('Gemini API call failed with status:', apiResponse.status, errText);
      return NextResponse.json({ 
        success: false, 
        error: `Gemini API returned error ${apiResponse.status}: ${errText}` 
      }, { status: 502 });
    }

    const apiData = await apiResponse.json();
    const rawText = apiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      console.error('Gemini API returned empty response candidates:', apiData);
      return NextResponse.json({ 
        success: false, 
        error: 'Gemini API returned empty response candidates. Check API quota or key permissions.' 
      }, { status: 502 });
    }

    try {
      const parsed = JSON.parse(rawText.trim());
      if (!parsed.title || !parsed.content) {
        throw new Error('Title or Content missing in parsed JSON object');
      }
      
      console.log('Successfully generated note via Gemini API!');
      return NextResponse.json({
        success: true,
        title: parsed.title,
        tags: parsed.tags || ['AI Generated', category || 'General'],
        content: parsed.content
      });
    } catch (parseError: any) {
      console.error('Failed to parse Gemini response text as JSON:', rawText, parseError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to parse Gemini response as JSON: ${parseError.message}. Raw: ${rawText.substring(0, 300)}` 
      }, { status: 502 });
    }
  } catch (error: any) {
    console.error('API POST AI generate error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
