import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { reason, description, sessionId } = await req.json()

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required' },
        { status: 400 }
      )
    }

    // Get reporter IP from request
    const reporterIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

    // Get session data to determine which user is being reported
    let reportedIP = 'unknown'

    if (sessionId) {
      try {
        const session = await db.chatSession.findUnique({
          where: { id: sessionId }
        })

        if (session) {
          // Determine which IP to report based on who is making the report
          reportedIP = session.user1IP === reporterIP ? (session.user2IP || 'unknown') : session.user1IP
        }
      } catch (error) {
        console.error('Error fetching session:', error)
      }
    }

    // Create report record
    const report = await db.report.create({
      data: {
        sessionId: sessionId || 'unknown',
        reporterIP,
        reportedIP,
        reason,
        description: description || '',
        status: 'pending'
      }
    })

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        reason: report.reason,
        status: report.status
      },
      message: 'Report submitted successfully. Thank you for helping keep our platform safe.'
    })

  } catch (error) {
    console.error('Report submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    )
  }
}
