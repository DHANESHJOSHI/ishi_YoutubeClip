import axios from "axios";
import { saveClip } from "../../../lib/database.js";

// This API route is designed for Vercel Cron Jobs
// Add to vercel.json: { "cron": [{ "path": "/api/poll", "schedule": "*/5 * * * * *" }] }

global.activeSessions = global.activeSessions || new Map();
global.processedMessages = global.processedMessages || new Set();

export default async function handler(req, res) {
  // Only allow GET requests for Vercel Cron
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Verify it's a cron request (optional security)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  let totalProcessed = 0;
  let errors = [];

  try {
    // Process all active sessions
    if (global.activeSessions && global.activeSessions.size > 0) {
      for (const [videoId, session] of global.activeSessions.entries()) {
        if (session.isActive) {
          try {
            const result = await pollChatMessages(videoId);
            totalProcessed += result.messagesChecked;
          } catch (error) {
            errors.push({ videoId, error: error.message });
            
            // If error indicates stream ended, deactivate session
            if (error.response?.status === 403 || error.response?.status === 404) {
              session.isActive = false;
            }
          }
        }
      }
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      activeSessions: global.activeSessions ? global.activeSessions.size : 0,
      messagesProcessed: totalProcessed,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Cron poll error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function pollChatMessages(videoId) {
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

  // Filter and sort clip commands by timestamp (latest first)
  const clipCommands = messages
    .filter(msg => {
      const text = msg.snippet.displayMessage;
      const isModerator = msg.authorDetails.isChatModerator;
      const isOwner = msg.authorDetails.isChatOwner;
      return text.startsWith("!clip") && (isModerator || isOwner) && !global.processedMessages.has(msg.id);
    })
    .sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));

  // Process only the latest !clip command
  if (clipCommands.length > 0) {
    const latestMsg = clipCommands[0];
    const messageId = latestMsg.id;
    const text = latestMsg.snippet.displayMessage;
    const authorName = latestMsg.authorDetails.displayName;
    const publishedAt = latestMsg.snippet.publishedAt;
    try {
      const clipData = {
        videoId,
        timestamp: publishedAt,
        moderator: authorName,
        command: text,
        messageId
      };

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
      console.log(`Latest clip created by ${authorName} at ${publishedAt}`);
      
    } catch (error) {
      console.error("Error saving latest clip:", error);
    }

    global.processedMessages.add(messageId);
  }

  // Count moderator commands (still check all messages for this)
  for (const msg of messages) {
    if (global.processedMessages.has(msg.id)) {
      continue;
    }
    
    const text = msg.snippet.displayMessage;
    const isModerator = msg.authorDetails.isChatModerator;
    const isOwner = msg.authorDetails.isChatOwner;
    
    if (text.startsWith("!chat") && (isModerator || isOwner)) {
      moderatorCommands++;
      console.log(`Moderator Command: ${text}`);
      global.processedMessages.add(msg.id);
    }
  }

  // Cleanup old processed messages
  if (global.processedMessages.size > 1000) {
    const messagesArray = Array.from(global.processedMessages);
    global.processedMessages = new Set(messagesArray.slice(-500));
  }

  return {
    messagesChecked: messages.length,
    clipsCreated,
    moderatorCommands,
    timestamp: new Date().toISOString()
  };
}
