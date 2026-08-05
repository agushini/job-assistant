import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function GET() {
  const useRealApi = process.env.USE_CLAUDE_API === 'true';

  if (!useRealApi) {
    return NextResponse.json({
      response: [{ type: 'text', text: 'Hello! (mock response — no API call made)' }],
      mock: true,
    });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Say hello in exactly 5 words.' },
      ],
    });

    return NextResponse.json({ response: message.content, mock: false });
  } catch (error) {
    console.error('Claude API error:', error);
    return NextResponse.json(
      { error: 'Failed to reach Claude API' },
      { status: 500 }
    );
  }
}