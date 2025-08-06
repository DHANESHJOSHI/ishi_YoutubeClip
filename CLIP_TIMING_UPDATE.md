# ⏰ Clip Timing Update: 30 Seconds BEFORE Timestamp

## 🎯 **Important Change Made**

**Previous Behavior**: When moderator types `!clip` at 1:23:45, clip was from 1:23:45 to 1:24:15 (30 seconds AFTER)

**New Behavior**: When moderator types `!clip` at 1:23:45, clip is from 1:23:15 to 1:23:45 (30 seconds BEFORE)

## 🧠 **Why This Makes Sense**

When someone sees something interesting and types `!clip`, they want to capture what **just happened**, not what's about to happen!

## 📝 **Files Updated**

### 1. [`lib/database.js`](lib/database.js)
```javascript
// OLD:
const startTime = new Date(timestamp);
const endTime = new Date(startTime.getTime() + 30000); // 30 seconds AFTER

// NEW:
const clipTimestamp = new Date(timestamp);
const startTime = new Date(clipTimestamp.getTime() - 30000); // 30 seconds BEFORE
const endTime = new Date(clipTimestamp.getTime()); // End at the timestamp
```

### 2. [`src/pages/api/download-direct.js`](src/pages/api/download-direct.js)
- Updated all YouTube links to use correct start times
- Fixed FFmpeg commands
- Updated yt-dlp commands
- Fixed online downloader links

### 3. [`src/pages/index.js`](src/pages/index.js)
- Updated UI instructions
- Added clarification in manual clip form
- Fixed MongoDB client-side import issue

## 🔄 **How It Works Now**

### **!clip Commands (Auto-detection)**
```
Moderator types !clip at: 1:23:45
→ Clip captured: 1:23:15 to 1:23:45 (30 seconds before)
```

### **Manual Clips**
```
User enters start time: 1:23:45, duration: 30s
→ Clip created: 1:23:45 to 1:24:15 (duration after start time)
```

## 📊 **Example Timeline**

```
1:23:00 -------- 1:23:15 ======== 1:23:45 -------- 1:24:15
                    ^                ^
                 Clip Start      !clip typed
                               (clip ends here)
```

## 🎬 **Download Links Generated**

- **YouTube**: `https://www.youtube.com/watch?v=VIDEO_ID&t=5015s` (starts at clip beginning)
- **Embed**: `https://www.youtube.com/embed/VIDEO_ID?start=5015&end=5045`
- **FFmpeg**: `ffmpeg -ss 5015 -i "stream_url" -t 30 -c copy clip.mp4`

## ✅ **Benefits**

1. **More Intuitive**: Captures the interesting moment that just happened
2. **Better for Highlights**: Perfect for reaction clips and key moments
3. **Viewer-Friendly**: Clips start with context, not abruptly
4. **Streamer Logic**: Matches how streamers naturally think about clipping

## 🔧 **Technical Details**

- **Auto-clips**: 30 seconds before timestamp
- **Manual clips**: Duration after start time (user controls exactly)
- **MongoDB**: Stores correct start/end times
- **Google Sheets**: Shows accurate timestamps
- **Download links**: All point to correct clip timing

---

✅ **Ready!** Now clips capture the 30 seconds BEFORE the !clip command, making them much more useful! 🎉
