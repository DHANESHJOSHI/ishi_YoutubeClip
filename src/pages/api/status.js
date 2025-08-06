// Status endpoint to check bot activity and sessions
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // You can expand this to check database for active sessions
    // For now, return basic status
    return res.status(200).json({
      success: true,
      status: 'online',
      timestamp: new Date().toISOString(),
      message: 'YouTube Live Clip Bot is running',
      version: '1.0.0',
      features: {
        clipDetection: 'active',
        googleSheets: 'active',
        mongoDatabase: 'active',
        autoPolling: 'active'
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({ 
      error: 'Failed to get status',
      details: error.message 
    });
  }
}
