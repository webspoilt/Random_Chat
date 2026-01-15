import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sessions - Check ban status
export async function GET(req: NextRequest) {
  try {
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Check if IP is banned
    const ban = await db.ban.findUnique({
      where: { ipAddress }
    })

    if (ban) {
      const isBanned = ban.permanent || (ban.expiresAt && ban.expiresAt > new Date())
      if (isBanned) {
        return NextResponse.json(
          {
            isBanned: true,
            reason: ban.reason,
            description: ban.description,
            expiresAt: ban.expiresAt
          },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({
      isBanned: false
    })

  } catch (error) {
    console.error('Session check error:', error)
    return NextResponse.json(
      { error: 'Failed to check session status' },
      { status: 500 }
    )
  }
}

// POST /api/sessions - Create new session
export async function POST(req: NextRequest) {
  try {
    const { mode, interests } = await req.json()

    if (!mode || (mode !== 'video' && mode !== 'text')) {
      return NextResponse.json(
        { error: 'Valid mode (video or text) is required' },
        { status: 400 }
      )
    }

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Check if IP is banned before creating session
    const existingBan = await db.ban.findUnique({
      where: { ipAddress }
    })

    if (existingBan) {
      const isBanned = existingBan.permanent || (existingBan.expiresAt && existingBan.expiresAt > new Date())
      if (isBanned) {
        return NextResponse.json(
          {
            error: 'IP is banned',
            reason: existingBan.reason,
            description: existingBan.description
          },
          { status: 403 }
        )
      }
    }

    // Create new session
    const session = await db.chatSession.create({
      data: {
        user1Id: `user-${Date.now()}`,
        user1IP: ipAddress,
        mode,
        interests: interests ? interests.join(',') : '',
        status: 'waiting'
      }
    })

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      status: session.status
    })

  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

// PATCH /api/sessions - Update session status
export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, status, user2Id, user2IP } = await req.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = { status }

    if (user2Id) updateData.user2Id = user2Id
    if (user2IP) updateData.user2IP = user2IP
    if (status === 'ended') updateData.endTime = new Date()

    const session = await db.chatSession.update({
      where: { id: sessionId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      session
    })

  } catch (error) {
    console.error('Session update error:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
