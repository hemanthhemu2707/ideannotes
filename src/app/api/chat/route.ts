import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // 1. Enforce Authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, history, topic } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'User prompt is required' }, { status: 400 });
    }

    // 2. Resolve Gemini API Endpoint
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAICOXz1Ddn_mvPMRts65X76YxWBTySWzQ';
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
