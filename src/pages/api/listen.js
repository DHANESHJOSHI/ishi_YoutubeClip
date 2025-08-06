import axios from "axios";
import { saveClip } from "../../../lib/database.js";

// Global storage for processed messages
global.processedMessages = global.processedMessages || new Set();

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { videoId, action = "start" } = req.body;

      if (!videoId) {
        return res.status(400).json({ message: "VideoId is required" });
      }

      const session = global.activeSessions?.get(videoId);
      if (!session) {
        return res.status(400).json({ message: "Session not found. Please initialize first." });
      }

      if (action === "start") {
        // Activate session for Vercel Cron polling
        session.isActive = true;

        return res.json({ 
          message: "Session activated for auto-polling via Vercel Cron", 
          videoId,
          interval: "30 seconds (Vercel Cron)",
          note: "Polling happens automatically via /api/poll endpoint"
        });

      } else if (action === "stop") {
        // Deactivate session
        session.isActive = false;

        return res.json({ 
          message: "Session deactivated", 
          videoId 
        });

      } else if (action === "manual") {
        // Manual single poll
        const result = await pollChatMessages(videoId);
        return res.json(result);
      }

    } catch (err) {
      console.error("Listen error:", err.message);
      return res.status(500).json({ 
        error: "Failed to process request", 
        details: err.message 
      });
    }
  } else if (req.method === "GET") {
    // Get status of all active sessions
    const sessions = {};
    if (global.activeSessions) {
      for (const [videoId, session] of global.activeSessions.entries()) {
        sessions[videoId] = {
          title: session.title,
          isActive: session.isActive,
          startTime: session.startTime,
          lastPolled: session.lastPolled
        };
      }
    }

    // Disable caching for real-time updates
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.json({ 
      sessions,
      timestamp: new Date().toISOString(),
      totalSessions: Object.keys(sessions).length
    });
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function pollChatMessages(videoId) {
  try {
    const session = global.activeSessions?.get(videoId);
    if (!session) {
      throw new Error("Session not found");
    }

    const params = {
      liveChatId: session.liveChatId,
      part: "snippet,authorDetails",
      key: process.env.YT_API_KEY,
      maxResults: 200
    };

    // Add pageToken if available
    if (session.nextPageToken) {
      params.pageToken = session.nextPageToken;
    }

    const chatRes = await axios.get(
      `https://www.googleapis.com/youtube/v3/liveChat/messages`,
      { params }
    );

    const data = chatRes.data;
    session.nextPageToken = data.nextPageToken;
    session.lastPolled = new Date();

    const messages = data.items || [];
    let clipsCreated = 0;
    let moderatorCommands = 0;

    for (const msg of messages) {
      const messageId = msg.id;
      
      // Skip if already processed
      if (global.processedMessages.has(messageId)) {
        continue;
      }

      const text = msg.snippet.displayMessage;
      const isModerator = msg.authorDetails.isChatModerator;
      const isOwner = msg.authorDetails.isChatOwner;
      const authorName = msg.authorDetails.displayName;
      const publishedAt = msg.snippet.publishedAt;

      // Process !clip command (only from moderators/owner)
      if (text.startsWith("!clip") && (isModerator || isOwner)) {
        try {
          const clipData = {
            videoId,
            timestamp: publishedAt,
            moderator: authorName,
            command: text,
            messageId
          };

          // Save to MongoDB
          await saveClip(clipData);
          
          // Save to Google Sheets
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/append`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              timestamp: publishedAt,
              videoId,
              moderator: authorName,
              command: text
            })
          });

          clipsCreated++;
          console.log(`Clip created by ${authorName} at ${publishedAt}`);
          
        } catch (error) {
          console.error("Error saving clip:", error);
        }
      }

      // Process !chat command (only from moderators/owner)
      if (text.startsWith("!chat") && (isModerator || isOwner)) {
        moderatorCommands++;
        console.log(`Moderator Command by ${authorName}: ${text}`);
      }

      // Mark message as processed
      global.processedMessages.add(messageId);
    }

    // Cleanup old processed messages (keep only last 1000)
    if (global.processedMessages.size > 1000) {
      const messagesArray = Array.from(global.processedMessages);
      global.processedMessages = new Set(messagesArray.slice(-500));
    }

    return {
      message: "Chat polled successfully",
      videoId,
      messagesChecked: messages.length,
      clipsCreated,
      moderatorCommands,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Polling error for ${videoId}:`, error.message);
    
    // If quota exceeded or chat ended, deactivate session
    if (error.response?.status === 403 || error.response?.status === 404) {
      const session = global.activeSessions?.get(videoId);
      if (session) session.isActive = false;
    }
    
    throw error;
  }
}
