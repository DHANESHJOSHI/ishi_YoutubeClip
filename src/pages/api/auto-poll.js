// Auto-polling endpoint for background clip detection
import { connectToDatabase } from '../../../lib/database.js';

// Store active polling sessions
let activeSessions = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId, action = 'start' } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    if (action === 'start') {
      // Start auto-polling for this video
      if (activeSessions.has(videoId)) {
        return res.status(200).json({ 
          success: true, 
          message: 'Auto-polling already active for this video',
          sessionActive: true
        });
      }

      // Start polling session
      const sessionData = {
        videoId,
        startTime: new Date(),
        isActive: true,
        pollCount: 0,
        lastPollTime: null
      };
      
      activeSessions.set(videoId, sessionData);
      
      // Start the polling loop
      startPollingLoop(videoId);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Auto-polling started',
        sessionActive: true
      });
      
    } else if (action === 'stop') {
      // Stop auto-polling for this video
      if (activeSessions.has(videoId)) {
        const session = activeSessions.get(videoId);
        session.isActive = false;
        activeSessions.delete(videoId);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Auto-polling stopped',
          sessionActive: false
        });
      } else {
        return res.status(200).json({ 
          success: true, 
          message: 'No active session found',
          sessionActive: false
        });
      }
      
    } else if (action === 'status') {
      // Check status
      const isActive = activeSessions.has(videoId);
      const session = isActive ? activeSessions.get(videoId) : null;
      
      return res.status(200).json({
        success: true,
        sessionActive: isActive,
        session: session ? {
          startTime: session.startTime,
          pollCount: session.pollCount,
          lastPollTime: session.lastPollTime
        } : null
      });
    }

  } catch (error) {
    console.error('Auto-poll error:', error);
    return res.status(500).json({ 
      error: 'Failed to manage auto-polling',
      details: error.message 
    });
  }
}

async function startPollingLoop(videoId) {
  const session = activeSessions.get(videoId);
  if (!session || !session.isActive) {
    return;
  }

  try {
    // Poll for new chat messages and detect !clip commands
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/chat?videoId=${videoId}&limit=10`);
    
    if (response.ok) {
      const data = await response.json();
      session.pollCount++;
      session.lastPollTime = new Date();
      
      // Process messages for !clip commands
      if (data.messages && Array.isArray(data.messages)) {
        for (const message of data.messages) {
          if (message.text && message.text.toLowerCase().includes('!clip')) {
            console.log(`🎬 Auto-detected !clip command from ${message.author.name}: ${message.text}`);
            
            // Save clip to database and append to sheets
            try {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/append`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  videoId,
                  message: message.text,
                  timestamp: message.timestamp,
                  author: message.author.name,
                  channelName: message.author.channelName || 'Unknown'
                })
              });
            } catch (error) {
              console.error('Failed to process auto-detected clip:', error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Auto-poll error for ${videoId}:`, error);
  }

  // Continue polling if session is still active
  if (session && session.isActive && activeSessions.has(videoId)) {
    setTimeout(() => startPollingLoop(videoId), 30000); // Poll every 30 seconds
  }
}
