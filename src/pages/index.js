import { useState, useEffect, useRef } from "react";
import Head from "next/head";

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [clips, setClips] = useState([]);
  const [sessions, setSessions] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [showClipModal, setShowClipModal] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [showManualClip, setShowManualClip] = useState(false);
  const [manualClipData, setManualClipData] = useState({
    videoUrl: '',
    startTime: '',
    duration: 30
  });
  const chatEndRef = useRef(null);

  // Poll for session status
  useEffect(() => {
    const interval = setInterval(fetchSessions, 10000); // Every 10 seconds
    fetchSessions(); // Initial fetch
    return () => clearInterval(interval);
  }, []);

  // Fetch clips and chat when session changes
  useEffect(() => {
    if (activeSession?.videoId) {
      fetchClips(activeSession.videoId);
      fetchChatMessages(activeSession.videoId);
      
      const clipsInterval = setInterval(() => fetchClips(activeSession.videoId), 2000); // Every 2 seconds
      const chatInterval = setInterval(() => fetchChatMessages(activeSession.videoId), 1000); // Every 1 second
      
      return () => {
        clearInterval(clipsInterval);
        clearInterval(chatInterval);
      };
    }
  }, [activeSession]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Handle modal keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showClipModal) {
        closeClipModal();
      }
    };

    if (showClipModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showClipModal]);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/listen");
      const data = await res.json();
      setSessions(data.sessions || {});
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  const fetchClips = async (videoId) => {
    try {
      const res = await fetch(`/api/clips?videoId=${videoId}`);
      const data = await res.json();
      if (data.success) {
        setClips(data.clips);
      }
    } catch (error) {
      console.error("Failed to fetch clips:", error);
    }
  };

  const fetchChatMessages = async (videoId) => {
    try {
      const res = await fetch(`/api/chat?videoId=${videoId}&limit=50`);
      const data = await res.json();
      if (data.success) {
        // Filter to show only moderator/owner messages and commands
        const filteredMessages = data.messages.filter(msg => 
          msg.author.isModerator || 
          msg.author.isOwner || 
          msg.isCommand
        );
        setChatMessages(filteredMessages);
        
        // Update status if clips were processed
        if (data.clipsProcessed > 0) {
          setStatus(prev => `${prev} • ${data.clipsProcessed} new clip(s) processed!`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch chat messages:", error);
    }
  };

  const startBot = async () => {
    if (!url.trim()) {
      setStatus("Please enter a YouTube Live URL");
      return;
    }

    setIsLoading(true);
    setStatus("Initializing bot...");

    try {
      // Initialize session
      const initRes = await fetch("/api/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const initData = await initRes.json();

      if (!initRes.ok) {
        throw new Error(initData.message || "Failed to initialize");
      }

      setActiveSession(initData);
      setStatus(`Bot initialized for: ${initData.title}`);

      // Start auto-polling
      const listenRes = await fetch("/api/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          videoId: initData.videoId, 
          action: "start" 
        })
      });

      const listenData = await listenRes.json();

      if (listenRes.ok) {
        setStatus(`✅ Bot is now listening to chat (polling every ${listenData.interval})`);
      } else {
        throw new Error(listenData.message || "Failed to start polling");
      }

    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopBot = async () => {
    if (!activeSession) return;

    try {
      await fetch("/api/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          videoId: activeSession.videoId, 
          action: "stop" 
        })
      });

      setStatus("Bot stopped");
      setActiveSession(null);
      setClips([]);
      setChatMessages([]);
    } catch (error) {
      setStatus(`Error stopping bot: ${error.message}`);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const openClipModal = async (clip) => {
    try {
      // Fetch detailed clip info
      const res = await fetch(clip.downloadLink.url);
      const clipData = await res.json();
      setSelectedClip({ ...clip, detailedInfo: clipData });
      setShowClipModal(true);
    } catch (error) {
      console.error("Failed to fetch clip details:", error);
      // Fallback to basic clip info
      setSelectedClip(clip);
      setShowClipModal(true);
    }
  };

  const closeClipModal = () => {
    setShowClipModal(false);
    setSelectedClip(null);
  };

  const openManualClipForm = () => {
    setShowManualClip(true);
  };

  const closeManualClipForm = () => {
    setShowManualClip(false);
    setManualClipData({ videoUrl: '', startTime: '', duration: 30 });
  };

  const generateManualClip = async () => {
    if (!manualClipData.videoUrl || !manualClipData.startTime) {
      setStatus("❌ Please enter both video URL and start time");
      return;
    }

    try {
      setStatus("🎬 Generating manual clip...");

      // Extract video ID from URL
      let videoId;
      try {
        const urlObj = new URL(manualClipData.videoUrl);
        if (urlObj.hostname.includes('youtube.com')) {
          if (urlObj.pathname.includes('/live/')) {
            videoId = urlObj.pathname.split('/live/')[1].split('?')[0];
          } else if (urlObj.pathname.includes('/watch')) {
            videoId = urlObj.searchParams.get('v');
          }
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.split('/')[1].split('?')[0];
        }
      } catch (error) {
        throw new Error("Invalid YouTube URL format");
      }

      if (!videoId) {
        throw new Error("Could not extract video ID from URL");
      }

      // Parse start time (supports formats like "1:23:45", "23:45", "45", "1h23m45s")
      const startSeconds = parseTimeToSeconds(manualClipData.startTime);
      if (startSeconds === null) {
        throw new Error("Invalid time format. Use formats like: 1:23:45, 23:45, 45, or 1h23m45s");
      }

      // For manual clips, startTime is where user wants it, endTime is startTime + duration
      const manualStartTime = new Date(Date.now() - (Date.now() % 1000) + startSeconds * 1000);
      const manualEndTime = new Date(manualStartTime.getTime() + manualClipData.duration * 1000);
      
      const startTime = manualStartTime.toISOString();
      const endTime = manualEndTime.toISOString();

      // Create manual clip
      const clipData = {
        videoId,
        timestamp: startTime,
        moderator: "Manual Entry",
        command: `!clip (${manualClipData.startTime} for ${manualClipData.duration}s)`,
        messageId: `manual_${Date.now()}`
      };

      // Save to MongoDB via API
      const mongoResponse = await fetch("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clipData)
      });

      // Save to Google Sheets
      const sheetsResponse = await fetch("/api/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: startTime,
          videoId,
          moderator: "Manual Entry",
          command: clipData.command,
          channelId: "manual",
          channelName: "Manual Entry"
        })
      });

      let mongoSuccess = false;
      if (mongoResponse.ok) {
        mongoSuccess = true;
      }

      let sheetsSuccess = false;
      if (sheetsResponse.ok) {
        sheetsSuccess = true;
      } else {
        const errorData = await sheetsResponse.json();
        console.error("Google Sheets error:", errorData);
      }

      // Show appropriate status message
      if (mongoSuccess && sheetsSuccess) {
        setStatus("✅ Manual clip created successfully!");
      } else if (mongoSuccess) {
        setStatus("⚠️ Clip saved to database but Google Sheets error occurred");
      } else {
        setStatus("❌ Failed to save clip");
      }

      closeManualClipForm();
      
      // Refresh clips if we have an active session
      if (activeSession?.videoId === videoId) {
        fetchClips(videoId);
      }

    } catch (error) {
      setStatus(`❌ Error creating manual clip: ${error.message}`);
    }
  };

  // Parse various time formats to seconds
  const parseTimeToSeconds = (timeStr) => {
    timeStr = timeStr.trim();
    
    // Format: 1h23m45s
    const hmsMatch = timeStr.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (hmsMatch) {
      const hours = parseInt(hmsMatch[1] || 0);
      const minutes = parseInt(hmsMatch[2] || 0);
      const seconds = parseInt(hmsMatch[3] || 0);
      return hours * 3600 + minutes * 60 + seconds;
    }

    // Format: 1:23:45 or 23:45
    const colonMatch = timeStr.match(/^(?:(\d+):)?(\d+):(\d+)$/);
    if (colonMatch) {
      const hours = parseInt(colonMatch[1] || 0);
      const minutes = parseInt(colonMatch[2]);
      const seconds = parseInt(colonMatch[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }

    // Format: just seconds
    const secondsMatch = timeStr.match(/^\d+$/);
    if (secondsMatch) {
      return parseInt(timeStr);
    }

    return null;
  };

  return (
    <>
      <Head>
        <title>YouTube Live Clip Bot</title>
        <meta name="description" content="Auto-detect !clip commands from YouTube live chat" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
              YouTube Live Clip Bot || Ishi Playss
            </h1>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  YouTube Live Stream URL
                </label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2 border text-black border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={startBot}
                  disabled={isLoading || activeSession}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Starting..." : "Start Listening"}
                </button>

                <button
                  onClick={openManualClipForm}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  ✂️ Manual Clip
                </button>

                {activeSession && (
                  <>
                    <button
                      onClick={() => fetchChatMessages(activeSession.videoId)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Check Now
                    </button>
                    <button
                      onClick={stopBot}
                      className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Stop Bot
                    </button>
                  </>
                )}
              </div>

              {status && (
                <div className={`p-3 rounded-md ${
                  status.includes("❌") ? "bg-red-100 text-red-800" :
                  status.includes("✅") ? "bg-green-100 text-green-800" :
                  "bg-blue-100 text-blue-800"
                }`}>
                  {status}
                </div>
              )}
            </div>
          </div>

          {/* Active Sessions */}
          {Object.keys(sessions).length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-black">
              <h2 className="text-xl font-semibold mb-4">Active Sessions</h2>
              <div className="space-y-2">
                {Object.entries(sessions).map(([videoId, session]) => (
                  <div key={videoId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{session.title}</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded ${
                        session.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}>
                        {session.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {session.lastPolled ? `Last: ${formatTimestamp(session.lastPolled)}` : "Not polled"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Content - Split Layout */}
          {activeSession && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Live Chat Display - Left Side */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  Live Chat - {activeSession.title}
                  <span className="ml-2 text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                    🟢 Fresh Start
                  </span>
                </h2>
                
                <div className="border border-gray-200 rounded-lg h-96 overflow-y-auto bg-gray-50 p-3 space-y-2">
                  {chatMessages.length === 0 ? (
                    <p className="text-gray-500 text-center">Waiting for chat messages...</p>
                  ) : (
                    chatMessages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`p-2 rounded-lg text-sm ${
                          message.isClipCommand && message.author.isModerator 
                            ? 'bg-green-100 border-l-4 border-green-500' 
                            : message.isChatCommand && message.author.isModerator
                            ? 'bg-blue-100 border-l-4 border-blue-500'
                            : message.author.isModerator 
                            ? 'bg-yellow-50 border-l-4 border-yellow-400'
                            : 'bg-white border-l-4 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {message.author.avatar && (
                            <img 
                              src={message.author.avatar} 
                              alt={message.author.name}
                              className="w-5 h-5 rounded-full"
                            />
                          )}
                          <span className={`font-medium ${
                            message.author.isOwner ? 'text-red-600' :
                            message.author.isModerator ? 'text-blue-600' : 'text-gray-700'
                          }`}>
                            {message.author.name}
                            {message.author.isOwner && ' 👑'}
                            {message.author.isModerator && ' 🛡️'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className={`text-gray-800 ${
                          message.isCommand ? 'font-mono font-bold' : ''
                        }`}>
                          {message.text}
                        </div>
                        {message.isClipCommand && message.author.isModerator && (
                          <div className="text-xs text-green-600 mt-1">
                            ✂️ Clip command detected!
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="mt-3 text-xs text-gray-500">
                  🔴 Live chat updates every 1 second • Only showing moderator messages & commands
                  <br />Green = !clip commands • Blue = !chat commands • Click &quot;Check Now&quot; for instant processing
                </div>
              </div>

              {/* Clips Display - Right Side */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  Generated Clips ({clips.length})
                </h2>
                
                {clips.length === 0 ? (
                  <p className="text-gray-600">No clips created yet. Waiting for !clip commands from moderators...</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {clips.map((clip) => (
                      <div key={clip.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-800">{clip.moderator}</span>
                            <span className="text-gray-600 ml-2">{clip.command}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatTimestamp(clip.timestamp)}
                          </span>
                        </div>
                        
                        {clip.downloadLink && (
                          <div className="mt-2 space-x-2">
                            <button
                              onClick={() => openClipModal(clip)}
                              className="inline-block px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              🎬 View Clip
                            </button>
                            <span className="text-xs text-gray-500">
                              Duration: {Math.floor((new Date(clip.downloadLink.endTime) - new Date(clip.downloadLink.startTime)) / 1000)}s
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">How it works:</h3>
            <ul className="text-blue-700 space-y-1">
              <li>• Enter a YouTube Live stream URL and click &quot;Start Listening&quot;</li>
              <li>• Bot monitors live chat via browser polling (1 sec) + server auto-polling (30 sec backup)</li>
              <li>• When moderators type &quot;!clip&quot;, 30 seconds BEFORE that timestamp gets captured</li>
              <li>• Use &quot;✂️ Manual Clip&quot; to create clips from any video with custom timing</li>
              <li>• Only chat moderators and stream owners can create clips via chat</li>
              <li>• View all generated clips with download links and options</li>
            </ul>
          </div>

          {/* Clip Details Modal */}
          {showClipModal && selectedClip && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 text-white"
              onClick={closeClipModal}
            >
              <div 
                className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                      🎬 Clip Details
                    </h3>
                    <button
                      onClick={closeClipModal}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  {/* Clip Info */}
                  <div className="space-y-4 text-black">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">📝 Command Info</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Moderator:</span>
                          <span className="ml-2 font-medium">{selectedClip.moderator}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Command:</span>
                          <span className="ml-2 font-mono bg-gray-200 px-2 py-1 rounded">{selectedClip.command}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Timestamp:</span>
                          <span className="ml-2">{formatTimestamp(selectedClip.timestamp)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Duration:</span>
                          <span className="ml-2">{Math.floor((new Date(selectedClip.downloadLink.endTime) - new Date(selectedClip.downloadLink.startTime)) / 1000)}s</span>
                        </div>
                      </div>
                    </div>

                    {/* YouTube Links */}
                    {selectedClip.detailedInfo && (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-800 mb-3">🔗 YouTube Links</h4>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-blue-600 mb-1">Watch from timestamp:</p>
                            <a
                              href={selectedClip.detailedInfo.links.youtube}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors inline-flex items-center gap-2"
                            >
                              🎥 Open in YouTube
                            </a>
                          </div>
                          
                          <div>
                            <p className="text-sm text-blue-600 mb-1">Embed link:</p>
                            <div className="bg-white border rounded p-2">
                              <code className="text-xs text-gray-600 break-all">
                                {selectedClip.detailedInfo.links.embed}
                              </code>
                              <button
                                onClick={() => navigator.clipboard.writeText(selectedClip.detailedInfo.links.embed)}
                                className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
                              >
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Time Info */}
                    {selectedClip.detailedInfo && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-800 mb-3">⏰ Time Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-green-600">Start Time:</span>
                            <span className="font-mono">{new Date(selectedClip.detailedInfo.clipInfo.startTime).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-600">End Time:</span>
                            <span className="font-mono">{new Date(selectedClip.detailedInfo.clipInfo.endTime).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-600">Duration:</span>
                            <span className="font-mono">{selectedClip.detailedInfo.clipInfo.duration} seconds</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Preview (YouTube Embed) */}
                    {selectedClip.detailedInfo && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-800 mb-3">📺 Video Preview</h4>
                        <div className="aspect-video bg-black rounded overflow-hidden">
                          <iframe
                            src={selectedClip.detailedInfo.links.embed}
                            className="w-full h-full"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Clip Preview"
                          ></iframe>
                        </div>
                      </div>
                    )}

                    {/* Download Note */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">📥 Download Note</h4>
                      <p className="text-yellow-700 text-sm">
                        Direct download feature requires additional implementation with yt-dlp and cloud storage.
                        Currently showing YouTube links and timestamps for manual processing.
                      </p>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={closeClipModal}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                    >
                      Close
                    </button>
                    {selectedClip.detailedInfo && (
                      <a
                        href={selectedClip.detailedInfo.links.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        🎥 Watch on YouTube
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual Clip Form Modal */}
          {showManualClip && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={closeManualClipForm}
            >
              <div 
                className="bg-white rounded-lg max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">
                    ✂️ Create Manual Clip
                  </h3>
                  <button
                    onClick={closeManualClipForm}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube Video URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                      value={manualClipData.videoUrl}
                      onChange={(e) => setManualClipData({...manualClipData, videoUrl: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      type="text"
                      placeholder="1:23:45, 23:45, 145, or 1h23m45s"
                      value={manualClipData.startTime}
                      onChange={(e) => setManualClipData({...manualClipData, startTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formats: 1:23:45 (H:M:S), 23:45 (M:S), 145 (seconds), 1h23m45s
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Clip Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={manualClipData.duration}
                      onChange={(e) => setManualClipData({...manualClipData, duration: parseInt(e.target.value) || 30})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                    />
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3">
                    <h4 className="font-medium text-purple-800 mb-1">📝 Example:</h4>
                    <p className="text-sm text-purple-700">
                      URL: https://www.youtube.com/watch?v=abc123<br/>
                      Start: 1:23:45 (1 hour, 23 minutes, 45 seconds)<br/>
                      Duration: 30 seconds<br/>
                      <strong>Note:</strong> For manual clips, duration is AFTER start time.<br/>
                      For !clip commands, 30 seconds BEFORE the timestamp is captured.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={closeManualClipForm}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateManualClip}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    🎬 Generate Clip
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
