import { google } from "googleapis";
import { getSheetIdForChannel, getChannelConfig } from "../../../lib/channels.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { timestamp, videoId, moderator, command, channelId, channelName } = req.body;

      if (!timestamp) {
        return res.status(400).json({ message: "Timestamp is required" });
      }

      // Get channel-specific configuration
      const channelConfig = getChannelConfig(channelId, channelName);
      const sheetId = getSheetIdForChannel(channelId, channelName);

      console.log("📊 Google Sheets Debug Info:", {
        channelId,
        channelName,
        channelConfig: channelConfig.name,
        sheetId,
        moderator,
        command,
        timestamp
      });

      if (!sheetId) {
        console.error("❌ No Sheet ID found for channel");
        return res.status(400).json({ 
          message: "No Google Sheet configured for this channel",
          channelInfo: channelConfig
        });
      }

      // Check Google Service Account
      if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
        console.error("❌ GOOGLE_SERVICE_ACCOUNT not configured");
        return res.status(500).json({ message: "Google Service Account not configured" });
      }

      // Initialize Google Sheets API
      let credentials;
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
      } catch (err) {
        console.error("❌ Invalid GOOGLE_SERVICE_ACCOUNT JSON:", err);
        return res.status(500).json({ message: "Invalid Google Service Account configuration" });
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });

      const sheets = google.sheets({ version: "v4", auth });
      
      // Prepare data for sheet with proper timestamp formatting
      const clipTime = new Date(timestamp);
      const currentTime = new Date();
      
      // Generate YouTube URL with timestamp (30 seconds before clip command)
      let youtubeUrl = "N/A";
      
      try {
        // Get video details to find actual live stream start time
        const session = global.activeSessions?.get(videoId);
        
        if (session) {
          // For live streams, we need to calculate time relative to when stream actually started
          // This is a simplified approach - for exact timing you'd need YouTube API to get actual stream start
          const clipTime = new Date(timestamp);
          const botStartTime = new Date(session.startTime);
          
          // Calculate seconds from when bot started to clip time
          const secondsFromBotStart = Math.floor((clipTime - botStartTime) / 1000);
          
          // For !clip commands, go 30 seconds BEFORE the command
          const clipStartSeconds = Math.max(0, secondsFromBotStart - 30);
          
          youtubeUrl = `https://youtu.be/${videoId}?t=${clipStartSeconds}`;
          
          console.log(`🔗 Generated YouTube URL: ${youtubeUrl} (${clipStartSeconds}s from bot start)`);
        } else {
          youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }
      } catch (error) {
        console.error("Error generating YouTube URL:", error);
        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      }
      
      const rowData = [
        clipTime.toLocaleString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        videoId || "N/A", 
        moderator || "Unknown",
        command || "!clip",
        channelConfig.name,
        youtubeUrl, // YouTube URL with timestamp
        currentTime.toLocaleString('en-IN', { 
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
      ];

      console.log("📝 Writing to Google Sheets:", { sheetId, rowData });

      // Append to Google Sheet
      const appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A:G", // A=timestamp, B=videoId, C=moderator, D=command, E=channel, F=youtube_url, G=processed_at
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { 
          values: [rowData]
        }
      });

      console.log("✅ Google Sheets success:", appendResult.data);

      return res.json({ 
        message: "Timestamp saved to Google Sheets successfully",
        data: {
          timestamp,
          videoId,
          moderator,
          command,
          channel: channelConfig.name,
          sheetId,
          rowsUpdated: appendResult.data.updates?.updatedRows || 1
        }
      });

    } catch (err) {
      console.error("Google Sheets append error:", err.message);
      return res.status(500).json({ 
        error: "Failed to save to Google Sheets", 
        details: err.message 
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
