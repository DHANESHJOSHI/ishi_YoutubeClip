import { exec } from 'child_process';
import { promisify } from 'util';
import { getChannelConfig } from "../../../lib/channels.js";

const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { videoId, start, end, channelId, channelName } = req.query;

      if (!videoId || !start || !end) {
        return res.status(400).json({ 
          message: "VideoId, start, and end parameters are required" 
        });
      }

      // Get channel config for clip duration
      const channelConfig = getChannelConfig(channelId, channelName);
      const clipDuration = channelConfig.settings.clipDuration || 30;

      const clipEndSeconds = Math.floor(new Date(end).getTime() / 1000);
      const clipStartSeconds = Math.floor(new Date(start).getTime() / 1000);
      const actualDuration = Math.min(clipEndSeconds - clipStartSeconds, clipDuration);
      
      // For !clip commands, we want 30 seconds BEFORE the timestamp
      // start and end are already calculated correctly in database.js
      
      console.log(`🎬 Generating download for: ${videoId}, start: ${clipStartSeconds}, duration: ${actualDuration}s`);

      // Method 1: yt-dlp direct stream URL (no download)
      try {
        const ytDlpCommand = `yt-dlp -f "best[height<=720]" --get-url "https://www.youtube.com/watch?v=${videoId}"`;
        console.log("📺 Running yt-dlp command:", ytDlpCommand);
        
        const { stdout: streamUrl } = await execAsync(ytDlpCommand, { 
          timeout: 10000 // 10 second timeout
        });
        
        if (streamUrl && streamUrl.trim()) {
          const cleanStreamUrl = streamUrl.trim();
          console.log("✅ Got stream URL:", cleanStreamUrl.substring(0, 100) + "...");
          
          return res.json({
            success: true,
            method: "yt-dlp_stream",
            videoId,
            clipInfo: {
              startTime: start,
              endTime: end,
              duration: actualDuration,
              startSeconds: clipStartSeconds,
              endSeconds: clipEndSeconds
            },
            links: {
              // YouTube links - starts at actual clip beginning (30 seconds before command)
              youtube: `https://youtu.be/${videoId}?t=${clipStartSeconds}`,
              embed: `https://www.youtube.com/embed/${videoId}?start=${clipStartSeconds}&end=${clipEndSeconds}`,
              
              // Direct stream URL with timestamp parameters
              directStream: `${cleanStreamUrl}#t=${clipStartSeconds},${clipEndSeconds}`,
              
              // FFmpeg command for manual download
              ffmpegCommand: `ffmpeg -ss ${clipStartSeconds} -i "${cleanStreamUrl}" -t ${actualDuration} -c copy "${videoId}_clip_${clipStartSeconds}.mp4"`,
              
              // yt-dlp command for direct download
              ytDlpCommand: `yt-dlp --external-downloader ffmpeg --external-downloader-args "ffmpeg_i:-ss ${clipStartSeconds} -t ${actualDuration}" -f "best[height<=720]" "https://www.youtube.com/watch?v=${videoId}" -o "${videoId}_clip_${clipStartSeconds}.%(ext)s"`
            },
            downloadInstructions: {
              method1: "Use the directStream URL with a video player that supports seeking",
              method2: "Run the ffmpegCommand in terminal to download the clip",
              method3: "Run the ytDlpCommand in terminal for automatic download",
              method4: "Use the YouTube link to watch from timestamp"
            }
          });
        }
      } catch (ytDlpError) {
        console.log("⚠️ yt-dlp not available or failed:", ytDlpError.message);
      }

      // Method 2: Alternative download methods without yt-dlp
      return res.json({
        success: true,
        method: "alternative_methods",
        videoId,
        clipInfo: {
          startTime: start,
          endTime: end,
          duration: actualDuration,
          startSeconds: clipStartSeconds,
          endSeconds: clipEndSeconds
        },
        links: {
          // YouTube links
          youtube: `https://youtu.be/${videoId}?t=${clipStartSeconds}`,
          embed: `https://www.youtube.com/embed/${videoId}?start=${clipStartSeconds}&end=${clipEndSeconds}`,
          
          // Online downloaders with timestamp
          onlineDownloaders: [
            {
              name: "Y2mate",
              url: `https://www.y2mate.com/download-youtube/${videoId}`,
              note: `Manually seek to ${Math.floor(clipStartSeconds/60)}:${clipStartSeconds%60} and download ${actualDuration}s`
            },
            {
              name: "SaveFrom",
              url: `https://en.savefrom.net/#url=https://www.youtube.com/watch?v=${videoId}&utm_source=youtube&utm_medium=short_domains&utm_campaign=www.ssyoutube.com`,
              note: "Download full video, then trim using video editor"
            },
            {
              name: "ClipConverter", 
              url: `https://www.clipconverter.cc/`,
              note: `Paste: https://youtu.be/${videoId}?t=${clipStartSeconds}`
            }
          ]
        },
        installInstructions: {
          ytDlp: "Install yt-dlp: pip install yt-dlp",
          ffmpeg: "Install FFmpeg: https://ffmpeg.org/download.html",
          usage: "After installation, restart the server to enable direct downloads"
        },
        manualSteps: [
          `1. Open: https://youtu.be/${videoId}?t=${clipStartSeconds}`,
          `2. Use a screen recorder or browser extension to capture ${actualDuration} seconds`,
          `3. Or download full video and trim from ${Math.floor(clipStartSeconds/60)}:${clipStartSeconds%60} to ${Math.floor(clipEndSeconds/60)}:${clipEndSeconds%60}`
        ]
      });

    } catch (err) {
      console.error("Download generation error:", err);
      return res.status(500).json({ 
        error: "Failed to generate download options", 
        details: err.message,
        fallback: {
          youtube: `https://youtu.be/${req.query.videoId}?t=${Math.max(0, Math.floor(new Date(req.query.start).getTime() / 1000) - 30)}`,
          message: "Use YouTube link to watch from timestamp"
        }
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
