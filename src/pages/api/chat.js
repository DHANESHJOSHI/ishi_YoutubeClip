import axios from "axios";

// Store recent chat messages for display (no need for separate pageTokens)
global.recentChatMessages = global.recentChatMessages || new Map();

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { videoId, limit = 50 } = req.query;

      if (!videoId) {
        return res.status(400).json({ message: "VideoId is required" });
      }

      const session = global.activeSessions?.get(videoId);
      if (!session || !session.liveChatId) {
        return res.status(400).json({ message: "No active live chat session found" });
      }

      const params = {
        liveChatId: session.liveChatId,
        part: "snippet,authorDetails",
        key: process.env.YT_API_KEY,
        maxResults: 20 // Get only latest 20 messages for better performance
      };

      // For fresh chat, only get new messages using nextPageToken from session
      // This prevents showing old chat history when bot starts mid-stream
      if (session.nextPageToken) {
        params.pageToken = session.nextPageToken;
      } else {
        // If no token yet, don't fetch anything (wait for first poll cycle)
        return res.json({
          success: true,
          videoId,
          messages: [],
          totalMessages: 0,
          clipsProcessed: 0,
          timestamp: new Date().toISOString(),
          pollingInterval: 5000,
          note: "Bot starting - waiting for new messages"
        });
      }

      const chatRes = await axios.get(
        `https://www.googleapis.com/youtube/v3/liveChat/messages`,
        { params }
      );

      const data = chatRes.data;
      
      // Update session's nextPageToken for continuous polling
      if (data.nextPageToken) {
        session.nextPageToken = data.nextPageToken;
      }

      const messages = data.items || [];
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        text: msg.snippet.displayMessage,
        author: {
          name: msg.authorDetails.displayName,
          avatar: msg.authorDetails.profileImageUrl,
          isModerator: msg.authorDetails.isChatModerator,
          isOwner: msg.authorDetails.isChatOwner,
          channelId: msg.authorDetails.channelId
        },
        timestamp: msg.snippet.publishedAt,
        isCommand: msg.snippet.displayMessage.startsWith('!'),
        isClipCommand: msg.snippet.displayMessage.startsWith('!clip'),
        isChatCommand: msg.snippet.displayMessage.startsWith('!chat')
      }));

      // Process !clip commands from moderators - only NEW ones
      let clipsProcessed = 0;
      
      // Filter for !clip commands by moderators/owners that haven't been processed
      const newClipCommands = formattedMessages
        .filter(msg => 
          msg.isClipCommand && 
          (msg.author.isModerator || msg.author.isOwner) &&
          !global.processedMessages.has(msg.id)
        )
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Only process the most recent NEW !clip command if any
      if (newClipCommands.length > 0) {
        const latestClipCommand = newClipCommands[0];
        
        console.log(`🔄 Processing new !clip command from ${latestClipCommand.author.name}: ${latestClipCommand.text}`);
        
        // Double-check to prevent race conditions
        if (!global.processedMessages.has(latestClipCommand.id)) {
          try {
              const clipData = {
              videoId,
              timestamp: latestClipCommand.timestamp,
              moderator: latestClipCommand.author.name,
              command: latestClipCommand.text,
              messageId: latestClipCommand.id
              };

              // Save to MongoDB
              const { saveClip } = await import("../../../lib/database.js");
              await saveClip(clipData);
              
              // Get session for channel info
              const session = global.activeSessions?.get(videoId);
              
              // Save to Google Sheets
              const sheetsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/append`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
              timestamp: latestClipCommand.timestamp,
              videoId,
              moderator: latestClipCommand.author.name,
              command: latestClipCommand.text,
              channelId: session?.channelId,
              channelName: session?.channelTitle
              })
              });

              if (!sheetsResponse.ok) {
              const errorData = await sheetsResponse.json();
              console.error("❌ Google Sheets error:", errorData);
              } else {
              const successData = await sheetsResponse.json();
              console.log("✅ Google Sheets saved:", successData);
              }

            global.processedMessages.add(latestClipCommand.id);
            clipsProcessed++;
            console.log(`✅ New clip saved: ${latestClipCommand.author.name} - ${latestClipCommand.text}`);
            
          } catch (error) {
            console.error("❌ Error processing new clip command:", error);
          }
        } else {
          console.log(`⚠️ Clip command already processed: ${latestClipCommand.id}`);
        }
      }

      // Store recent messages (keep last 100)
      if (!global.recentChatMessages.has(videoId)) {
        global.recentChatMessages.set(videoId, []);
      }
      
      const recentMessages = global.recentChatMessages.get(videoId);
      recentMessages.push(...formattedMessages);
      
      // Keep only last 100 messages
      if (recentMessages.length > 100) {
        recentMessages.splice(0, recentMessages.length - 100);
      }

      // Disable caching for real-time updates
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.json({
        success: true,
        videoId,
        messages: formattedMessages,
        totalMessages: formattedMessages.length,
        clipsProcessed,
        timestamp: new Date().toISOString(),
        pollingInterval: data.pollingIntervalMillis || 5000
      });

    } catch (err) {
      console.error("Chat fetch error:", err.message);
      
      // Handle specific YouTube API errors
      if (err.response?.status === 403) {
        console.error("❌ YouTube API 403 Error - Check API key or video permissions");
        return res.status(403).json({ 
          error: "YouTube API access denied", 
          details: "Invalid API key, quota exceeded, or video doesn't have live chat enabled",
          suggestion: "Check your YouTube API key and ensure the video is a live stream with chat enabled"
        });
      }
      
      if (err.response?.status === 404) {
        console.error("❌ YouTube API 404 Error - Live chat not found");
        return res.status(404).json({ 
          error: "Live chat not found", 
          details: "The video may not be live or doesn't have chat enabled"
        });
      }
      
      return res.status(500).json({ 
        error: "Failed to fetch chat messages", 
        details: err.message,
        apiError: err.response?.data || null
      });
    }

  } else if (req.method === "POST") {
    // Get stored recent messages
    try {
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ message: "VideoId is required" });
      }

      const recentMessages = global.recentChatMessages.get(videoId) || [];
      
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      return res.json({
        success: true,
        videoId,
        messages: recentMessages.slice(-50), // Last 50 messages
        totalMessages: recentMessages.length,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      return res.status(500).json({ 
        error: "Failed to get recent messages", 
        details: err.message 
      });
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
