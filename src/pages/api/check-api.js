// API health check endpoint to test YouTube API configuration
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoId } = req.query;

    // Check if API key exists
    if (!process.env.YT_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "YouTube API key not found",
        details: "YT_API_KEY environment variable is not set"
      });
    }

    // Test basic YouTube API access
    try {
      const testVideoId = videoId || "dQw4w9WgXcQ"; // Default test video
      const videoResponse = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos`,
        {
          params: {
            part: "snippet,liveStreamingDetails",
            id: testVideoId,
            key: process.env.YT_API_KEY
          }
        }
      );

      const video = videoResponse.data.items[0];
      if (!video) {
        return res.status(404).json({
          success: false,
          error: "Video not found",
          videoId: testVideoId
        });
      }

      const isLive = video.snippet.liveBroadcastContent === "live";
      const hasLiveStreamingDetails = !!video.liveStreamingDetails;
      const liveChatId = video.liveStreamingDetails?.activeLiveChatId;

      return res.status(200).json({
        success: true,
        message: "YouTube API is working",
        apiKeyStatus: "✅ Valid",
        video: {
          id: video.id,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          isLive,
          hasLiveStreamingDetails,
          liveChatId: liveChatId || null,
          liveChatEnabled: !!liveChatId
        },
        recommendations: {
          canFetchChat: isLive && !!liveChatId,
          issues: [
            ...(isLive ? [] : ["⚠️ Video is not currently live"]),
            ...(liveChatId ? [] : ["⚠️ Live chat is not enabled for this video"]),
          ]
        }
      });

    } catch (apiError) {
      if (apiError.response?.status === 403) {
        return res.status(403).json({
          success: false,
          error: "YouTube API access denied",
          details: "API key is invalid, quota exceeded, or insufficient permissions",
          apiKeyStatus: "❌ Invalid or No Permissions",
          suggestions: [
            "1. Check if YT_API_KEY in .env.local is correct",
            "2. Ensure YouTube Data API v3 is enabled in Google Cloud Console", 
            "3. Check API quota limits",
            "4. Verify API key has proper restrictions"
          ]
        });
      }

      if (apiError.response?.status === 404) {
        return res.status(404).json({
          success: false,
          error: "Video not found",
          details: "The specified video ID does not exist"
        });
      }

      return res.status(500).json({
        success: false,
        error: "YouTube API error",
        details: apiError.message,
        status: apiError.response?.status,
        apiResponse: apiError.response?.data
      });
    }

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: error.message
    });
  }
}
