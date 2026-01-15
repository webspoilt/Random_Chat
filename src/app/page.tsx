'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, MessageSquare, SkipForward, Mic, MicOff, Video, VideoOff, AlertTriangle, X, Flag, Send, Users } from 'lucide-react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { io, Socket } from 'socket.io-client'

type ChatMode = 'video' | 'text'
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'ended'

export default function Home() {
  const [showAgeModal, setShowAgeModal] = useState(true)
  const [ageAccepted, setAgeAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>('video')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [messages, setMessages] = useState<Array<{ from: 'me' | 'them', text: string }>>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [customInterest, setCustomInterest] = useState('')
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showBanModal, setShowBanModal] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [muted, setMuted] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [showAdBanner, setShowAdBanner] = useState(false)
  const [userId] = useState(() => `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<any>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const availableInterests = ['Music', 'Movies', 'Gaming', 'Sports', 'Tech', 'Art', 'Books', 'Travel']

  useEffect(() => {
    // Show ad banner periodically
    const adInterval = setInterval(() => {
      setShowAdBanner(true)
      setTimeout(() => setShowAdBanner(false), 5000)
    }, 60000) // Every 60 seconds

    return () => clearInterval(adInterval)
  }, [])

  useEffect(() => {
    // Track ad impression when shown
    if (showAdBanner) {
      trackAdImpression('banner', 'ad-001')
    }
  }, [showAdBanner])

  const trackAdImpression = async (placement: string, adId: string) => {
    try {
      await fetch('/api/ads/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement, adId })
      })
    } catch (error) {
      console.error('Failed to track ad impression:', error)
    }
  }

  const trackAdClick = async (placement: string, adId: string) => {
    try {
      await fetch('/api/ads/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement, adId })
      })
    } catch (error) {
      console.error('Failed to track ad click:', error)
    }
  }

  const handleStartChat = async () => {
    if (!ageAccepted || !termsAccepted) {
      setShowTermsModal(true)
      return
    }

    setConnectionStatus('connecting')
    setShowAgeModal(false)

    if (chatMode === 'video') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: !muted })
        localStreamRef.current = stream
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }

        // Connect to signaling server
        connectToSignalingServer()
      } catch (error) {
        console.error('Failed to access camera:', error)
        alert('Failed to access camera/microphone. Please grant permissions.')
        setConnectionStatus('disconnected')
      }
    } else {
      // Text mode - just connect to signaling server
      connectToSignalingServer()
    }
  }

  const connectToSignalingServer = useCallback(() => {
    console.log('Connecting to signaling server...')

    // Connect to Socket.io server
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      query: {
        userId,
        mode: chatMode,
        interests: interests.join(',')
      }
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to signaling server')
      // Start looking for a match
      socket.emit('find-match')
    })

    socket.on('waiting', (data) => {
      console.log('Waiting for match:', data.message)
      setConnectionStatus('connecting')
    })

    socket.on('matched', async (data) => {
      console.log('Matched with:', data.partnerUserId)
      setSessionId(data.sessionId)
      setConnectionStatus('connected')

      if (chatMode === 'video') {
        await startVideoCall(data.partnerUserId, socket)
      }
    })

    socket.on('offer', async (data) => {
      console.log('Received offer from:', data.from)
      await handleOffer(data.offer, data.from)
    })

    socket.on('answer', async (data) => {
      console.log('Received answer from:', data.from)
      await handleAnswer(data.answer)
    })

    socket.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.from)
      await handleIceCandidate(data.candidate)
    })

    socket.on('message', (data) => {
      console.log('Received message from:', data.from)
      setMessages(prev => [...prev, { from: 'them', text: data.message }])
    })

    socket.on('partner-skipped', () => {
      console.log('Partner skipped')
      handleNext()
    })

    socket.on('partner-disconnected', () => {
      console.log('Partner disconnected')
      handleNext()
    })

    socket.on('banned', (data) => {
      console.log('IP banned:', data)
      setBanReason(data.reason)
      setShowBanModal(true)
      setShowAgeModal(true)
      setConnectionStatus('ended')
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from signaling server')
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      alert('Failed to connect to chat server. Please try again.')
      setConnectionStatus('disconnected')
    })
  }, [userId, chatMode, interests])

  const startVideoCall = async (partnerUserId: string, socket: Socket) => {
    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }

      const pc = new RTCPeerConnection(configuration)
      peerConnectionRef.current = pc

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!)
        })
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track')
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { candidate: event.candidate })
        }
      }

      // Create offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('offer', { offer })

    } catch (error) {
      console.error('Error starting video call:', error)
      alert('Failed to start video call. Please try again.')
    }
  }

  const handleOffer = async (offer: RTCSessionDescriptionInit, partnerUserId: string) => {
    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }

      const pc = new RTCPeerConnection(configuration)
      peerConnectionRef.current = pc

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!)
        })
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track')
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit('ice-candidate', { candidate: event.candidate })
        }
      }

      // Set remote description and create answer
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socketRef.current?.emit('answer', { answer })

    } catch (error) {
      console.error('Error handling offer:', error)
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer)
      }
    } catch (error) {
      console.error('Error handling answer:', error)
    }
  }

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
    }
  }

  const handleNext = () => {
    setMessages([])
    setConnectionStatus('connecting')

    // Notify server we want to skip
    if (socketRef.current) {
      socketRef.current.emit('skip')
    }

    // Close existing peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }

    // Wait a bit then look for new match
    setTimeout(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('find-match')
      }
    }, 500)
  }

  const handleSendMessage = () => {
    if (!currentMessage.trim()) return

    const newMessage = { from: 'me' as const, text: currentMessage }
    setMessages(prev => [...prev, newMessage])

    // Send to socket if connected
    if (socketRef.current && connectionStatus === 'connected') {
      socketRef.current.emit('message', { message: currentMessage })
    }

    setCurrentMessage('')

    // Check for abusive language
    checkAbusiveLanguage(currentMessage)
  }

  const checkAbusiveLanguage = async (text: string) => {
    try {
      const response = await fetch('/api/moderation/check-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionId })
      })

      const result = await response.json()
      if (result.isInappropriate || result.isBanned) {
        handleViolation(result.reason || 'abusive_language', text)
      }
    } catch (error) {
      console.error('Failed to check text:', error)
    }
  }

  const handleViolation = (type: string, content?: string) => {
    setBanReason(type)
    setShowBanModal(true)
    setShowAgeModal(true)
    setConnectionStatus('ended')
  }

  const handleReport = async (reason: string) => {
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      setShowReportModal(false)
      handleNext()
    } catch (error) {
      console.error('Failed to submit report:', error)
    }
  }

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest))
    } else {
      setInterests([...interests, interest])
    }
  }

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      setInterests([...interests, customInterest.trim()])
      setCustomInterest('')
    }
  }

  const toggleMute = () => {
    const newMuted = !muted
    setMuted(newMuted)
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = newMuted)
    }
  }

  const toggleVideo = () => {
    const newVideoEnabled = !videoEnabled
    setVideoEnabled(newVideoEnabled)
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => track.enabled = newVideoEnabled)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              RandomChat
            </h1>
          </div>
          <Button variant="ghost" onClick={() => setShowTermsModal(true)}>
            Terms & Conditions
          </Button>
        </div>
      </header>

      {/* Ad Banner */}
      {showAdBanner && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white py-2 px-4 text-center">
          <p className="text-sm font-medium">
            🎉 Limited Offer! Check out our premium features -{' '}
            <button
              onClick={() => trackAdClick('banner', 'ad-001')}
              className="underline font-bold hover:text-yellow-100"
            >
              Learn More
            </button>
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="ml-4 text-white hover:bg-white/20"
            onClick={() => setShowAdBanner(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Age Verification Modal */}
          <Dialog open={showAgeModal} onOpenChange={setShowAgeModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Welcome to RandomChat!</DialogTitle>
                <DialogDescription>
                  Please verify your age and accept our terms before continuing.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="age"
                    checked={ageAccepted}
                    onCheckedChange={(checked) => setAgeAccepted(checked as boolean)}
                  />
                  <Label htmlFor="age" className="text-sm">
                    I confirm that I am 16 years of age or older
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  />
                  <Label htmlFor="terms" className="text-sm">
                    I accept the Terms & Conditions and Privacy Policy
                  </Label>
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    By using this service, you agree to be bound by our terms. Any inappropriate
                    behavior will result in immediate IP ban.
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleStartChat}
                  disabled={!ageAccepted || !termsAccepted}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  Start Chatting
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Terms & Conditions Modal */}
          <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Terms & Conditions</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 text-sm">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>DISCLAIMER:</strong> This service is provided "as is" without any warranties.
                    The platform owners are not responsible for any content, interactions, or consequences
                    arising from the use of this service. You use this platform at your own risk.
                  </AlertDescription>
                </Alert>

                <div>
                  <h3 className="font-semibold mb-2">1. Age Requirement</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    You must be 16 years or older to use this platform. Misrepresenting your age will
                    result in immediate account termination.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">2. Content Policy</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    The following content is strictly prohibited and will result in immediate IP ban:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-gray-600 dark:text-gray-400">
                    <li>Nudity or sexually explicit content</li>
                    <li>Pornographic material</li>
                    <li>Weapons or firearms</li>
                    <li>Abusive or harassing language</li>
                    <li>Hate speech or discriminatory content</li>
                    <li>Illegal activities</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">3. Privacy & Anonymity</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    While this platform is anonymous, your IP address is logged for security purposes.
                    Do not share personal information with strangers.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">4. Content Filtering</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    We use AI-powered content filtering to detect inappropriate content. Any violation
                    will result in automatic IP ban without warning.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">5. Advertisements</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This platform is supported by advertisements. By using this service, you agree to
                    view ads as part of the free experience.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">6. No Refunds</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    This service is free to use. Any violations resulting in IP bans are permanent and
                    cannot be appealed.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setShowTermsModal(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Report Modal */}
          <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report User</DialogTitle>
                <DialogDescription>
                  Why are you reporting this user?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleReport('nudity')}
                >
                  Nudity or sexual content
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleReport('porn')}
                >
                  Pornographic material
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleReport('gun')}
                >
                  Weapons or firearms
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleReport('abusive_language')}
                >
                  Abusive or harassing language
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleReport('other')}
                >
                  Other (please describe)
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Ban Modal */}
          <Dialog open={showBanModal} onOpenChange={setShowBanModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Account Suspended
                </DialogTitle>
              </DialogHeader>
              <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your IP has been banned due to violation of our terms: <strong>{banReason}</strong>.
                  This ban is permanent. If you believe this is an error, please contact support.
                </AlertDescription>
              </Alert>
            </DialogContent>
          </Dialog>

          {/* Chat Mode Selection */}
          {connectionStatus === 'disconnected' && (
            <Card className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">Choose Your Chat Mode</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Meet new people randomly and anonymously
                </p>
              </div>

              <Tabs value={chatMode} onValueChange={(v) => setChatMode(v as ChatMode)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="video" className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Video Chat
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Text Chat
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="video" className="space-y-6">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 mb-4">
                      <Video className="w-12 h-12 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Video Chat</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Face-to-face conversations with random people from around the world
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-6">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 mb-4">
                      <MessageSquare className="w-12 h-12 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Text Chat</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Anonymous text-based conversations when you prefer not to use video
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Interest Tags */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">Add Interests (Optional)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Select topics you're interested in to find like-minded people
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {availableInterests.map(interest => (
                    <Badge
                      key={interest}
                      variant={interests.includes(interest) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom interest"
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                    value={customInterest}
                    onChange={(e) => setCustomInterest(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomInterest()}
                  />
                  <Button size="sm" onClick={addCustomInterest}>
                    Add
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleStartChat}
                disabled={!ageAccepted || !termsAccepted}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white h-12 text-lg"
              >
                Start Chatting
              </Button>

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Content is monitored by AI. Inappropriate behavior will result in immediate IP ban.
                </AlertDescription>
              </Alert>
            </Card>
          )}

          {/* Chat Interface */}
          {connectionStatus !== 'disconnected' && (
            <div className="grid gap-6">
              {/* Video Mode */}
              {chatMode === 'video' && connectionStatus === 'connected' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="overflow-hidden">
                    <div className="relative aspect-video bg-gray-900">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        You
                      </div>
                    </div>
                  </Card>
                  <Card className="overflow-hidden">
                    <div className="relative aspect-video bg-gray-900">
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Stranger
                      </div>
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="rounded-full"
                          onClick={toggleMute}
                        >
                          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="rounded-full"
                          onClick={toggleVideo}
                        >
                          {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Connection Status */}
              {connectionStatus === 'connecting' && (
                <Card className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-4" />
                  <p className="text-lg font-medium">Looking for someone to chat with...</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please wait while we find you a match
                  </p>
                </Card>
              )}

              {/* Controls */}
              {connectionStatus === 'connected' && (
                <Card className="p-6">
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button
                      onClick={handleNext}
                      size="lg"
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      <SkipForward className="w-5 h-5" />
                      Next Stranger
                    </Button>
                    <Button
                      onClick={() => setShowReportModal(true)}
                      size="lg"
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Flag className="w-5 h-5" />
                      Report
                    </Button>
                  </div>
                </Card>
              )}

              {/* Text Chat Area */}
              {(connectionStatus === 'connected' || chatMode === 'text') && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Messages</h3>

                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 min-h-[300px] max-h-[400px] overflow-y-auto mb-4 space-y-2">
                    {messages.length === 0 && (
                      <p className="text-center text-gray-500 dark:text-gray-400">
                        Say hi to start the conversation!
                      </p>
                    )}
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-lg ${
                            msg.from === 'me'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      className="flex-1 min-h-[60px]"
                    />
                    <Button onClick={handleSendMessage} size="icon" className="self-end">
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              )}

              {/* Interest Display */}
              {connectionStatus === 'connected' && interests.length > 0 && (
                <Card className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {interests.map(interest => (
                      <Badge key={interest} variant="secondary">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © 2024 RandomChat. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Button variant="ghost" size="sm" onClick={() => setShowTermsModal(true)}>
                Terms & Conditions
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowTermsModal(true)}>
                Privacy Policy
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 text-center">
            This service is provided "as is" without warranties. Use at your own risk.
          </p>
        </div>
      </footer>
    </div>
  )
}
