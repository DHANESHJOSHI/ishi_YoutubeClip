// API endpoint to check active sessions and auto-polling status
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const activeSessions = global.activeSessions ? 
      Array.from(global.activeSessions.entries()).map(([videoId, session]) => ({
        videoId,
        title: session.title,
        channelTitle: session.channelTitle,
        isActive: session.isActive,
        startTime: session.startTime,
        lastPolled: session.lastPolled,
        hasNextPageToken: !!session.nextPageToken
      })) : [];

    const processedMessageCount = global.processedMessages ? global.processedMessages.size : 0;

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      activeSessions: activeSessions.length,
      processedMessages: processedMessageCount,
      sessions: activeSessions,
      environment: {
        hasYtApiKey: !!process.env.YT_API_KEY,
        hasMongoUri: !!process.env.MONGODB_URI,
        hasGoogleServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT,
        nodeEnv: process.env.NODE_ENV
      }
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to get status",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
