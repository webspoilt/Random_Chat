import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(req: NextRequest) {
  try {
    const { text, sessionId, userIP } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // Get user IP from request if not provided
    const ip = userIP || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Check if IP is already banned
    const existingBan = await db.ban.findUnique({
      where: { ipAddress: ip }
    })

    if (existingBan && (existingBan.permanent || existingBan.expiresAt && existingBan.expiresAt > new Date())) {
      return NextResponse.json(
        {
          isInappropriate: true,
          isBanned: true,
          reason: existingBan.reason,
          message: 'Your IP has been banned due to previous violations.'
        },
        { status: 403 }
      )
    }

    // Use LLM to check for abusive language
    const zai = await ZAI.create()

    const moderationPrompt = `You are a content moderator for a chat platform. Analyze the following text for inappropriate content.

Check for:
- Profanity or abusive language
- Hate speech or discriminatory content
- Threats or harassment
- Sexual content or solicitation
- Any other inappropriate content

Text to analyze: "${text}"

Respond with ONLY one of these exact words:
- "APPROPRIATE" if the content is clean and safe
- "INAPPROPRIATE" if the content violates any rules`

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: moderationPrompt
        },
        {
          role: 'user',
          content: text
        }
      ],
      thinking: { type: 'disabled' }
    })

    const content = completion.choices[0]?.message?.content
    const result = content ? content.toUpperCase().trim() : ''

    const isInappropriate = result === 'INAPPROPRIATE'

    // Log violation if inappropriate
    if (isInappropriate) {
      // Use transaction to prevent race condition
      const [violationCount] = await db.$transaction([
        // Create violation record
        db.violation.create({
          data: {
            sessionId: sessionId || 'unknown',
            userIP: ip,
            type: 'abusive_language',
            contentData: text
          }
        }),
        // Count total violations atomically
        db.violation.count({
          where: { userIP: ip }
        })
      ])

      // Ban after first violation for text
      await db.ban.upsert({
        where: { ipAddress: ip },
        update: {
          count: violationCount,
          reason: 'abusive_language',
          description: 'Multiple abusive language violations',
          permanent: violationCount >= 3
        },
        create: {
          ipAddress: ip,
          reason: 'abusive_language',
          count: 1,
          permanent: false,
          description: 'Abusive language detected',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      })
    }

    return NextResponse.json({
      isInappropriate,
      result,
      message: isInappropriate
        ? 'This content violates our community guidelines.'
        : 'Content is appropriate'
    })

  } catch (error) {
    console.error('Text moderation error:', error)
    return NextResponse.json(
      { error: 'Failed to moderate text content' },
      { status: 500 }
    )
  }
}
