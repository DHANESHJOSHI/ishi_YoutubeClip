import axios from "axios";

// Global storage for active sessions
global.activeSessions = global.activeSessions || new Map();

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "YouTube URL is required" });
      }

      // Extract videoId from URL
      let videoId;
      try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname.includes('youtube.com')) {
          // Handle different youtube.com formats
          if (urlObj.pathname.includes('/live/')) {
            // Format: https://youtube.com/live/VIDEO_ID
            videoId = urlObj.pathname.split('/live/')[1].split('?')[0];
          } else if (urlObj.pathname.includes('/watch')) {
            // Format: https://youtube.com/watch?v=VIDEO_ID
            videoId = urlObj.searchParams.get('v');
          } else if (urlObj.pathname.includes('/embed/')) {
            // Format: https://youtube.com/embed/VIDEO_ID
            videoId = urlObj.pathname.split('/embed/')[1].split('?')[0];
          }
        } else if (urlObj.hostname.includes('youtu.be')) {
          // Format: https://youtu.be/VIDEO_ID
          videoId = urlObj.pathname.split('/')[1].split('?')[0];
        }
        
        if (!videoId || videoId.length !== 11) {
          throw new Error("Invalid YouTube URL or Video ID");
        }
      } catch (error) {
        return res.status(400).json({ 
          message: "Invalid YouTube URL format. Supported formats: youtube.com/watch?v=, youtube.com/live/, youtu.be/" 
        });
      }

      // Get video details and liveChatId from YouTube API
      const ytRes = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos`,
        {
          params: {
            part: "liveStreamingDetails,snippet",
            id: videoId,
            key: process.env.YT_API_KEY
          }
        }
      );

      if (!ytRes.data.items || ytRes.data.items.length === 0) {
        return res.status(400).json({ message: "Video not found" });
      }

      const video = ytRes.data.items[0];
      const liveChatId = video.liveStreamingDetails?.activeLiveChatId;

      if (!liveChatId) {
        return res.status(400).json({ 
          message: "No active live chat found. Make sure the video is currently live streaming." 
        });
      }

      // Get current live chat position to start fresh (no old messages)
      let initialPageToken = null;
      try {
        const initialChatRes = await axios.get(
          `https://www.googleapis.com/youtube/v3/liveChat/messages`,
          {
            params: {
              liveChatId,
              part: "snippet",
              key: process.env.YT_API_KEY,
              maxResults: 1 // Just get the current position
            }
          }
        );
        
        // Use the nextPageToken to start from current time
        initialPageToken = initialChatRes.data.nextPageToken;
        console.log(`🚀 Bot starting fresh from current live chat position`);
        
      } catch (chatErr) {
        console.warn("⚠️ Could not get initial chat position, starting without token:", chatErr.message);
      }

      // Store session data
      const sessionData = {
        videoId,
        liveChatId,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        startTime: new Date(),
        isActive: true,
        lastPolled: null,
        nextPageToken: initialPageToken // Start from current position
      };

      global.activeSessions.set(videoId, sessionData);

      return res.json({ 
        message: "Bot initialized successfully", 
        videoId,
        liveChatId,
        title: sessionData.title,
        channelTitle: sessionData.channelTitle
      });
      
    } catch (err) {
      console.error("Init error:", err.message);
      return res.status(500).json({ 
        error: "Failed to initialize bot", 
        details: err.message 
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
