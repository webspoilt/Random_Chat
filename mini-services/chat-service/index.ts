import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/'
})

// Store waiting users: key = mode, value = array of { socketId, userId, interests, ip }
const waitingUsers: Map<string, Array<{ socketId: string, userId: string, interests: string[], ip: string }>> = new Map()

// Store active matches: key = userId, value = { partnerUserId, sessionId, mode }
const activeMatches: Map<string, { partnerUserId: string, sessionId: string, mode: string }> = new Map()

// Initialize waiting queues
const modes = ['video', 'text']
modes.forEach(mode => {
  waitingUsers.set(mode, [])
})

io.on('connection', async (socket) => {
  console.log(`Client connected: ${socket.id}`)

  const userId = socket.handshake.query.userId as string
  const mode = socket.handshake.query.mode as string
  const interests = socket.handshake.query.interests ? (socket.handshake.query.interests as string).split(',') : []
  const ip = socket.handshake.headers['x-forwarded-for'] as string || socket.handshake.headers['x-real-ip'] as string || 'unknown'

  // Note: Ban checking and session creation is now handled by Next.js API routes
  // to avoid database conflicts. The frontend will call the Next.js API before connecting.

  // Handle user looking for match
  socket.on('find-match', async () => {
    console.log(`User ${userId} looking for ${mode} match`)

    const queue = waitingUsers.get(mode) || []

    // Check if there's a waiting user with matching interests
    const matchIndex = queue.findIndex(user => {
      if (user.userId === userId) return false
      // If both have interests, check for overlap
      if (user.interests.length > 0 && interests.length > 0) {
        const hasCommonInterest = user.interests.some(i => interests.includes(i))
        return hasCommonInterest
      }
      // If no interests specified, match with anyone
      return true
    })

    if (matchIndex !== -1) {
      // Found a match!
      const matchedUser = queue[matchIndex]
      queue.splice(matchIndex, 1)

      // Generate session ID
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Store in local memory
      activeMatches.set(userId, { partnerUserId: matchedUser.userId, sessionId, mode })
      activeMatches.set(matchedUser.userId, { partnerUserId: userId, sessionId, mode })

      // Notify both users
      socket.emit('matched', {
        partnerUserId: matchedUser.userId,
        sessionId
      })

      const matchedSocket = io.sockets.sockets.get(matchedUser.socketId)
      if (matchedSocket) {
        matchedSocket.emit('matched', {
          partnerUserId: userId,
          sessionId
        })
      }

      console.log(`Matched ${userId} with ${matchedUser.userId} (session: ${sessionId})`)
    } else {
      // No match found, add to queue
      queue.push({ socketId: socket.id, userId, interests, ip })
      waitingUsers.set(mode, queue)
      socket.emit('waiting', { message: 'Looking for a match...' })
    }
  })

  // WebRTC signaling
  socket.on('offer', (data) => {
    const match = activeMatches.get(userId)
    if (match) {
      const partnerSocket = [...io.sockets.sockets.values()].find(s =>
        s.handshake.query.userId === match.partnerUserId
      )
      if (partnerSocket) {
        partnerSocket.emit('offer', {
          offer: data.offer,
          from: userId
        })
      }
    }
  })

  socket.on('answer', (data) => {
    const match = activeMatches.get(userId)
    if (match) {
      const partnerSocket = [...io.sockets.sockets.values()].find(s =>
        s.handshake.query.userId === match.partnerUserId
      )
      if (partnerSocket) {
        partnerSocket.emit('answer', {
          answer: data.answer,
          from: userId
        })
      }
    }
  })

  socket.on('ice-candidate', (data) => {
    const match = activeMatches.get(userId)
    if (match) {
      const partnerSocket = [...io.sockets.sockets.values()].find(s =>
        s.handshake.query.userId === match.partnerUserId
      )
      if (partnerSocket) {
        partnerSocket.emit('ice-candidate', {
          candidate: data.candidate,
          from: userId
        })
      }
    }
  })

  // Text messages
  socket.on('message', (data) => {
    const match = activeMatches.get(userId)
    if (match) {
      const partnerSocket = [...io.sockets.sockets.values()].find(s =>
        s.handshake.query.userId === match.partnerUserId
      )
      if (partnerSocket) {
        partnerSocket.emit('message', {
          message: data.message,
          from: userId
        })
      }
    }
  })

  // Skip to next match
  socket.on('skip', async () => {
    const match = activeMatches.get(userId)
    if (match) {
      // Notify partner
      const partnerSocket = [...io.sockets.sockets.values()].find(s =>
        s.handshake.query.userId === match.partnerUserId
      )
      if (partnerSocket) {
        partnerSocket.emit('partner-skipped')
      }

      // Clear match
      activeMatches.delete(userId)
      activeMatches.delete(match.partnerUserId)
    }

    socket.emit('skipped')
  })

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)

    // Remove from waiting queue
    modes.forEach(m => {
      const queue = waitingUsers.get(m) || []
      const index = queue.findIndex(u => u.userId === userId)
      if (index !== -1) {
        queue.splice(index, 1)
        waitingUsers.set(m, queue)
      }
    })

    // End active match
    const match = activeMatches.get(userId)
    if (match) {
      const partnerSocket = [...io.sockets.sockets.values()].find(s =>
        s.handshake.query.userId === match.partnerUserId
      )
      if (partnerSocket) {
        partnerSocket.emit('partner-disconnected')
      }

      activeMatches.delete(userId)
      activeMatches.delete(match.partnerUserId)
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`Chat signaling service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close()
  process.exit(0)
})
