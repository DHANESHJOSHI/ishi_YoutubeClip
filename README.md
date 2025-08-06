# YouTube Live Clip Bot

A Next.js application that automatically monitors YouTube live chat for `!clip` commands from moderators and stores timestamps in both MongoDB and Google Sheets.

## Features

- 🎥 **YouTube Live Chat Monitoring** - Automatically polls live chat every 5 seconds
- 👑 **Moderator-Only Commands** - Only chat moderators and stream owners can create clips
- 📊 **Dual Storage** - Saves clips to both MongoDB and Google Sheets
- 🔗 **Download Links** - Generates clip info with timestamps for easy access
- 📱 **Real-time UI** - Live updates of clips and session status
- ⚡ **Auto-polling** - Background monitoring without manual intervention

## Setup Instructions

### 1. Environment Variables

Create `.env.local` file and configure:

```env
# YouTube API Key (from Google Cloud Console)
YT_API_KEY=your_youtube_api_key_here

# Google Sheets Service Account JSON
GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
SHEET_ID=your_google_sheet_id_here

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/youtube_clips
# Or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/youtube_clips

# App URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 2. YouTube API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **YouTube Data API v3**
4. Create credentials (API Key)
5. Add your API key to `.env.local`

### 3. Google Sheets Setup

1. Create a Google Sheet for storing clips
2. Note the Sheet ID from URL
3. In Google Cloud Console:
   - Enable Google Sheets API
   - Create Service Account
   - Generate JSON key
   - Share the sheet with service account email
4. Add credentials to `.env.local`

### 4. MongoDB Setup

**Option A: Local MongoDB**
```bash
# Install MongoDB locally
brew install mongodb/brew/mongodb-community
brew services start mongodb/brew/mongodb-community
```

**Option B: MongoDB Atlas**
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create cluster and get connection string
3. Add to `.env.local`

### 5. Run the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000`

## Vercel Deployment

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 2. Configure Environment Variables

In Vercel Dashboard, add these environment variables:

```
YT_API_KEY=your_youtube_api_key
GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
SHEET_ID=your_google_sheet_id
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/youtube_clips
CRON_SECRET=your_random_secret_string (optional)
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

### 3. Vercel Cron Setup

The app uses [`vercel.json`](file:///media/dhanesh/techwithjoshi/Company/TechWithJoshi_Company/Ishitasharema/my-youtube-bot/vercel.json) for automated polling:

- **Polling Frequency**: Every 30 seconds
- **Endpoint**: `/api/poll` 
- **Security**: Optional CRON_SECRET for authentication

### 4. Environment Variable Security

For production, use Vercel's environment variable references:

```json
{
  "env": {
    "@yt_api_key": "your_actual_key",
    "@mongodb_uri": "your_actual_connection_string"
  }
}
```

## How to Use

1. **Enter YouTube Live URL** - Paste the live stream URL
2. **Start Listening** - Click to begin monitoring chat
3. **Monitor Commands** - Bot automatically detects:
   - `!clip` from moderators → Creates clip with timestamp
   - `!chat` from moderators → Logs moderator command
4. **View Clips** - All clips show in real-time with download info
5. **Stop Bot** - Stop monitoring when stream ends

## API Endpoints

- `POST /api/init` - Initialize chat monitoring for a video
- `POST /api/listen` - Start/stop session or manual poll
- `GET /api/listen` - Get status of all active sessions  
- `GET /api/poll` - Vercel Cron endpoint for automatic polling
- `POST /api/append` - Save timestamp to Google Sheets
- `GET /api/clips?videoId=xxx` - Get all clips for a video
- `GET /api/download?videoId=xxx&start=xxx&end=xxx` - Get clip download info

## File Structure

```
src/
├── pages/
│   ├── index.js              # Main UI
│   └── api/
│       ├── init.js           # Initialize session
│       ├── listen.js         # Chat polling with auto-polling
│       ├── append.js         # Google Sheets integration
│       ├── clips.js          # MongoDB clip management
│       └── download.js       # Generate download links
├── lib/
│   └── database.js           # MongoDB connection and helpers
└── .env.local                # Environment variables
```

## Features Breakdown

### Auto-Polling
- Uses Vercel Cron Jobs for automated polling every 30 seconds
- Serverless-friendly approach without background processes
- Handles API rate limits gracefully
- Automatically deactivates sessions when streams end

### Moderator Detection
- Only processes commands from chat moderators and stream owners
- Ignores `!clip` commands from regular viewers
- Logs `!chat` commands for moderator use

### Dual Storage
- **MongoDB**: Stores full clip data with download links
- **Google Sheets**: Simple timestamp log for external access

### Download Links
- Generates YouTube URLs with timestamp parameters
- Provides embed URLs for integration
- Calculates clip duration (default 30 seconds)

## Troubleshooting

### Common Issues

1. **"No active live chat found"**
   - Ensure the video is currently live streaming
   - Check if chat is enabled for the stream

2. **YouTube API quota exceeded**
   - Bot automatically stops polling
   - Check your API usage in Google Cloud Console

3. **Google Sheets permission denied**
   - Ensure service account email has edit access to the sheet
   - Verify GOOGLE_SERVICE_ACCOUNT JSON is properly formatted

4. **MongoDB connection failed**
   - For local: Ensure MongoDB service is running
   - For Atlas: Check connection string and network access

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Future Enhancements

- [ ] Actual video download with yt-dlp integration
- [ ] Cloud storage for hosting clip files
- [ ] User authentication and multi-user support
- [ ] Advanced clip editing (custom duration, start/end points)
- [ ] Webhook notifications for new clips
- [ ] Export clips data to different formats

## Security Notes

- Keep your API keys secure and never commit them to version control
- Service account keys should be treated as sensitive data
- Consider using environment variable injection for production deployment
- MongoDB connections should use authentication in production

---

Dhanesh bhai, yeh complete setup hai! 🚀 Auto-polling ke saath, MongoDB integration, aur download links sab kuch included hai.
# ishi_YoutubeClip
