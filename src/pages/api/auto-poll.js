import axios from "axios";
import { saveClip } from "../../../lib/database.js";

// Self-triggering polling function for Vercel
global.activeSessions = global.activeSessions || new Map();
global.processedMessages = global.processedMessages || new Set();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { action, videoId } = req.body;

  if (action === "start") {
    try {
      // Start the polling loop
      startPollingLoop(videoId);
      
      return res.json({
        success: true,
        message: "Auto-polling started",
        videoId,
        interval: "Every 30 seconds"
      });
      
    } catch (error) {
      return res.status(500).json({
        error: "Failed to start polling",
        details: error.message
      });
    }
    
  } else if (action === "stop") {
    // Stop polling for specific video
    const session = global.activeSessions?.get(videoId);
    if (session) {
      session.isActive = false;
    }
    
    return res.json({
      success: true,
      message: "Polling stopped",
      videoId
    });
  }

  return res.status(400).json({ message: "Invalid action" });
}

function startPollingLoop(videoId) {
  const session = global.activeSessions?.get(videoId);
  if (!session) {
    console.error("No session found for videoId:", videoId);
    return;
  }

  // Trigger the poll immediately
  pollChatMessages(videoId);

  // Set up recursive polling using setTimeout
  function scheduleNextPoll() {
    setTimeout(async () => {
      const currentSession = global.activeSessions?.get(videoId);
      if (currentSession && currentSession.isActive) {
        try {
          await pollChatMessages(videoId);
          scheduleNextPoll(); // Schedule next poll
        } catch (error) {
          console.error(`❌ Auto-polling error for ${videoId}:`, {
            status: error.response?.status,
            message: error.message,
            timestamp: new Date().toISOString()
          });
          
          // Stop if stream ended or access denied
          if (error.response?.status === 403 || error.response?.status === 404) {
            console.log(`🔴 Stream ended or access denied for ${videoId}. Stopping auto-polling.`);
            currentSession.isActive = false;
          } else if (error.response?.status === 429) {
            // Rate limit - wait longer before next poll
            console.log(`⏰ Rate limited for ${videoId}. Waiting 2 minutes before retry.`);
            setTimeout(() => scheduleNextPoll(), 120000); // 2 minutes
          } else {
            // Other errors - continue with normal interval
            console.log(`⚠️ Non-critical error for ${videoId}. Continuing polling.`);
            scheduleNextPoll();
          }
        }
      } else {
        console.log(`⏹️ Auto-polling stopped for ${videoId} (session inactive)`);
      }
    }, 30000); // 30 seconds
  }

  scheduleNextPoll();
}

async function pollChatMessages(videoId) {
  const session = global.activeSessions?.get(videoId);
  if (!session) {
    throw new Error(`Session not found for videoId: ${videoId}`);
  }

  if (!session.liveChatId) {
    throw new Error(`No liveChatId found for videoId: ${videoId}`);
  }

  const params = {
    liveChatId: session.liveChatId,
    part: "snippet,authorDetails",
    key: process.env.YT_API_KEY,
    maxResults: 50
  };

  if (session.nextPageToken) {
    params.pageToken = session.nextPageToken;
  }

  console.log(`🔍 Auto-polling chat for ${videoId} (liveChatId: ${session.liveChatId})`);

  const chatRes = await axios.get(
    `https://www.googleapis.com/youtube/v3/liveChat/messages`,
    { params }
  );

  const data = chatRes.data;
  session.nextPageToken = data.nextPageToken;
  session.lastPolled = new Date();

  const messages = data.items || [];
  let clipsCreated = 0;

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
      console.log(`🎬 Auto-poll clip created by ${authorName} at ${publishedAt}`);
      
    } catch (error) {
      console.error("Error saving auto-poll clip:", error);
    }

    global.processedMessages.add(messageId);
  }

  // Cleanup old processed messages
  if (global.processedMessages.size > 1000) {
    const messagesArray = Array.from(global.processedMessages);
    global.processedMessages = new Set(messagesArray.slice(-500));
  }

  return {
    messagesChecked: messages.length,
    clipsCreated,
    timestamp: new Date().toISOString()
  };
}
