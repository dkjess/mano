import { NextRequest, NextResponse } from 'next/server';
import { sendChatMessage } from '@/lib/api/chat';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { person_id, message: userMessage } = body;

    if (!person_id || !userMessage) {
      return NextResponse.json({ error: 'person_id and message are required' }, { status: 400 });
    }

    // Use new server-side API
    const response = await sendChatMessage(person_id, userMessage);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}