import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, sessionId, userIP } = await req.json()

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Image data is required' },
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
          isNsfw: true,
          isBanned: true,
          reason: existingBan.reason,
          message: 'Your IP has been banned due to previous violations.'
        },
        { status: 403 }
      )
    }

    // Use VLM to check image content
    const zai = await ZAI.create()

    const moderationPrompt = `You are a content moderator for a video chat platform. Analyze this image for inappropriate content.

Check for:
- Nudity or partially naked bodies
- Pornographic or sexually explicit content
- Weapons, firearms, or guns
- Any illegal or dangerous items
- Any other inappropriate content for a general audience

Respond with ONLY one of these exact words:
- "SAFE" if the image is clean and appropriate
- "NSFW_NUDITY" if nudity is detected
- "NSFW_PORN" if pornographic content is detected
- "NSFW_WEAPON" if weapons or guns are detected
- "NSFW_OTHER" if other inappropriate content is detected`

    const imageDataUrl = `data:image/jpeg;base64,${imageBase64}`

    const completion = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: moderationPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    })

    const result = completion.choices[0]?.message?.content?.toUpperCase().trim()

    const isNsfw = result !== 'SAFE'
    const violationType = result === 'NSFW_NUDITY' ? 'nudity' :
                         result === 'NSFW_PORN' ? 'porn' :
                         result === 'NSFW_WEAPON' ? 'gun' :
                         result === 'NSFW_OTHER' ? 'other' : null

    // Log violation if NSFW content detected
    if (isNsfw && violationType) {
      // Create violation record
      await db.violation.create({
        data: {
          sessionId: sessionId || 'unknown',
          userIP: ip,
          type: violationType,
          contentData: imageBase64.substring(0, 500) + '...' // Store truncated version
        }
      })

      // Update or create ban record - instant ban for NSFW content
      const violationCount = await db.violation.count({
        where: { userIP: ip }
      })

      await db.ban.upsert({
        where: { ipAddress: ip },
        update: {
          count: violationCount,
          reason: violationType,
          description: `${violationType} detected in video stream`,
          permanent: true // Permanent ban for NSFW content
        },
        create: {
          ipAddress: ip,
          reason: violationType,
          count: 1,
          permanent: true,
          description: `${violationType} detected in video stream`,
          expiresAt: null
        }
      })
    }

    return NextResponse.json({
      isNsfw,
      result,
      violationType,
      message: isNsfw
        ? `Inappropriate content detected: ${violationType}. Your IP has been banned.`
        : 'Image is appropriate'
    })

  } catch (error) {
    console.error('Image moderation error:', error)
    return NextResponse.json(
      { error: 'Failed to moderate image content' },
      { status: 500 }
    )
  }
}
