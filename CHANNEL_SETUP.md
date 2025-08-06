# 📺 Channel Setup Guide

## 🎯 Overview

Ab aapka YouTube Live Clip Bot channel-specific configurations support karta hai. Har channel ke liye alag Google Sheet aur settings ho sakti hai.

## 🛠 Channel Configuration

### 1. Environment Variables Setup

```bash
# Default Sheet (fallback)
SHEET_ID=your_default_sheet_id

# TechWithJoshi Channel
TWJ_SHEET_ID=your_techwithyoshi_sheet_id

# Ishita Sharma Channel  
IS_SHEET_ID=your_ishitasharma_sheet_id

# Google Service Account
GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 2. Adding New Channels

Edit [`lib/channels.js`](lib/channels.js):

```javascript
// Add new channel configuration
"UC_YOUR_CHANNEL_ID": {
  name: "Your Channel Name",
  shortName: "YCN", 
  sheetId: process.env.YOUR_SHEET_ID,
  moderators: ["ModeratorName1", "ModeratorName2"],
  settings: {
    clipDuration: 30, // seconds
    enableAutoClip: true,
    enableChatCommands: true
  }
}
```

## 📊 Google Sheets Setup

### 1. Create Separate Sheets for Each Channel

```
TechWithJoshi Sheet Columns:
A: Timestamp | B: VideoID | C: Moderator | D: Command | E: Channel | F: Processed At

Ishita Sharma Sheet Columns:  
A: Timestamp | B: VideoID | C: Moderator | D: Command | E: Channel | F: Processed At
```

### 2. Service Account Permissions

- Share each sheet with your service account email
- Give "Editor" permissions
- Copy each Sheet ID to environment variables

## 🎬 Download Links Features

### 🚀 New Direct Download Endpoint: `/api/download-direct`

#### Method 1: yt-dlp Integration (Best)

```bash
# Install yt-dlp on server
pip install yt-dlp

# Install FFmpeg  
# Ubuntu: sudo apt install ffmpeg
# Windows: Download from https://ffmpeg.org/
# macOS: brew install ffmpeg
```

**Features:**
- ✅ Direct stream URLs
- ✅ FFmpeg commands for clip extraction
- ✅ yt-dlp commands for automatic download
- ✅ No cloud storage required

#### Method 2: Alternative Download Options

जब yt-dlp available नहीं है:
- ✅ Online downloaders (Y2mate, SaveFrom, etc.)  
- ✅ Manual timestamp instructions
- ✅ Browser extension recommendations
- ✅ FFmpeg installation guide

### 📋 Example Download Response

```json
{
  "success": true,
  "method": "yt-dlp_stream",
  "links": {
    "youtube": "https://www.youtube.com/watch?v=VIDEO_ID&t=123s",
    "embed": "https://www.youtube.com/embed/VIDEO_ID?start=123&end=153", 
    "directStream": "https://direct-stream-url#t=123,153",
    "ffmpegCommand": "ffmpeg -ss 123 -i 'stream-url' -t 30 -c copy clip.mp4",
    "ytDlpCommand": "yt-dlp --external-downloader ffmpeg ..."
  },
  "downloadInstructions": {
    "method1": "Use directStream URL with video player",
    "method2": "Run ffmpegCommand in terminal", 
    "method3": "Run ytDlpCommand for auto-download"
  }
}
```

## 🔧 Debugging Google Sheets Issues

### Check Logs

```bash
# Server logs will show:
📊 Google Sheets Debug Info: {
  channelId: "UC...", 
  channelName: "TechWithJoshi",
  sheetId: "1abc...",
  moderator: "Joshi",
  command: "!clip"
}

✅ Google Sheets success: { updatedRows: 1 }
```

### Common Issues

1. **❌ "No Sheet ID found"**
   - Add SHEET_ID environment variable
   - Or add channel-specific sheet ID

2. **❌ "Invalid Google Service Account"**
   - Check GOOGLE_SERVICE_ACCOUNT JSON format
   - Verify service account has sheet access

3. **❌ "Permission denied"**
   - Share sheet with service account email
   - Give Editor permissions

## 🎯 Channel Detection Logic

```javascript
// Priority order:
1. Channel ID match (exact)
2. Channel name match (contains)
3. Short name match (exact)
4. Default configuration (fallback)
```

## 📱 Usage Instructions

### For TechWithJoshi:
1. Set TWJ_SHEET_ID environment variable
2. Moderators: ["TechWithJoshi", "Joshi"]
3. Clips saved to TechWithJoshi sheet

### For Ishita Sharma:
1. Set IS_SHEET_ID environment variable  
2. Moderators: ["IshitaSharma", "Ishita"]
3. Clips saved to Ishita Sharma sheet

### For New Channels:
1. Add configuration in [`lib/channels.js`](lib/channels.js)
2. Add CHANNEL_SHEET_ID environment variable
3. Share Google Sheet with service account
4. Deploy updates

## 🚀 Vercel Deployment

Update environment variables in Vercel Dashboard:

```
YT_API_KEY=...
GOOGLE_SERVICE_ACCOUNT=...
SHEET_ID=... (default)
TWJ_SHEET_ID=... (TechWithJoshi)
IS_SHEET_ID=... (Ishita Sharma)
MONGODB_URI=...
```

---

✅ **All Done!** Ab har channel ke liye alag setup hai aur download links bhi cloud storage ke bina generate hote hain! 🎉
