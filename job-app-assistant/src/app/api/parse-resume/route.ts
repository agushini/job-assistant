import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Defines the exact JSON shape we want Claude to return
const resumeSchema = {
  name: 'extract_resume',
  description: 'Extract structured resume data from raw text',
  input_schema: {
    type: 'object' as const,
    properties: {
      fullName: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      location: { type: 'string' },
      summary: { type: 'string', description: 'A short professional summary, or empty string if none present' },
      skills: {
        type: 'array',
        items: { type: 'string' },
      },
      workExperiences: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            title: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string', description: '"Present" if current job' },
            bulletPoints: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['company', 'title', 'bulletPoints'],
        },
      },
      education: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            school: { type: 'string' },
            degree: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
          required: ['school'],
        },
      },
    },
    required: ['fullName', 'workExperiences', 'education', 'skills'],
  },
};

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } else if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    throw new Error('Unsupported file type');
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const extractedText = await extractTextFromFile(file);

    const useRealApi = process.env.USE_CLAUDE_API === 'true';

    if (!useRealApi) {
      return NextResponse.json({
        extractedText,
        structuredData: {
          fullName: 'Mock Name',
          email: 'mock@example.com',
          phone: '555-0100',
          location: 'Mock City, ST',
          summary: '',
          skills: ['Mock Skill 1', 'Mock Skill 2'],
          workExperiences: [
            {
              company: 'Mock Company',
              title: 'Mock Title',
              startDate: '2020-01',
              endDate: 'Present',
              bulletPoints: ['Mock bullet point one', 'Mock bullet point two'],
            },
          ],
          education: [
            { school: 'Mock University', degree: 'Mock Degree', startDate: '2016', endDate: '2020' },
          ],
        },
        mock: true,
      });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      tools: [resumeSchema],
      tool_choice: { type: 'tool', name: 'extract_resume' },
      messages: [
        {
          role: 'user',
          content: `Extract structured data from this resume text:\n\n${extractedText}`,
        },
      ],
    });

    const toolUseBlock = message.content.find((block) => block.type === 'tool_use');
    const structuredData = toolUseBlock && 'input' in toolUseBlock ? toolUseBlock.input : null;

    return NextResponse.json({ extractedText, structuredData, mock: false });
  } catch (error) {
    console.error('Resume parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to process resume' },
      { status: 500 }
    );
  }
}