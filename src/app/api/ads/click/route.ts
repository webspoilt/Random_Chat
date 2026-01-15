import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { placement, adId, sessionId } = await req.json()

    if (!placement || !adId) {
      return NextResponse.json(
        { error: 'Placement and adId are required' },
        { status: 400 }
      )
    }

    // Get user IP from request
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Create ad click record
    const click = await db.adImpression.create({
      data: {
        sessionId: sessionId || null,
        ipAddress,
        adId,
        placement,
        impression: false,
        click: true
      }
    })

    return NextResponse.json({
      success: true,
      tracked: true
    })

  } catch (error) {
    console.error('Ad click tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track ad click' },
      { status: 500 }
    )
  }
}
