# 📊 Google Sheets Setup Guide

## 🎯 For Your Sheet: https://docs.google.com/spreadsheets/d/13-C2XtzoybboZfNFfv2jMH_Xwc-U80zxxHIxyxLF84M/edit

## 🛠 Automatic Setup (Recommended)

### Step 1: Use the Setup API

```bash
# Call this endpoint to automatically setup your sheet
POST /api/setup-sheets

{
  "sheetId": "13-C2XtzoybboZfNFfv2jMH_Xwc-U80zxxHIxyxLF84M"
}
```

**या curl command से:**

```bash
curl -X POST http://localhost:3000/api/setup-sheets \
  -H "Content-Type: application/json" \
  -d '{"sheetId": "13-C2XtzoybboZfNFfv2jMH_Xwc-U80zxxHIxyxLF84M"}'
```

### Step 2: What the API Does

✅ **Clears existing content**  
✅ **Adds proper headers**  
✅ **Formats headers with blue background**  
✅ **Sets column widths**  
✅ **Freezes header row**  
✅ **Adds sample data**  

## 📋 Manual Setup (Alternative)

If API setup doesn't work, manually add these headers:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Timestamp | Video ID | Moderator | Command | Channel | Processed At | Video Title | Stream Date |

### Column Details:
- **A: Timestamp** - When !clip was posted (ISO format)
- **B: Video ID** - YouTube video ID 
- **C: Moderator** - Who posted the !clip command
- **D: Command** - The exact command (!clip, !clip 30s, etc.)
- **E: Channel** - Which channel (TechWithJoshi, Ishita Sharma, etc.)
- **F: Processed At** - When our bot processed it
- **G: Video Title** - Title of the YouTube video
- **H: Stream Date** - Date of the live stream

## 🎨 Formatting (Manual)

1. **Header Row (Row 1):**
   - Bold text
   - Blue background (#3366CC)
   - Center aligned
   - Freeze row

2. **Column Widths:**
   - A (Timestamp): 200px
   - B (Video ID): 150px  
   - C-D (Moderator/Command): 120px each
   - E-H: Auto-fit

## 🔐 Permissions Setup

### Step 1: Share with Service Account

1. In your Google Sheet, click **"Share"**
2. Add your service account email (found in GOOGLE_SERVICE_ACCOUNT JSON)
3. Give **"Editor"** permissions
4. Uncheck **"Notify people"**

### Step 2: Environment Variables

Add to your `.env.local`:

```bash
SHEET_ID=13-C2XtzoybboZfNFfv2jMH_Xwc-U80zxxHIxyxLF84M
```

For channel-specific sheets:
```bash
TWJ_SHEET_ID=your_techwithyoshi_sheet_id
IS_SHEET_ID=your_ishitasharma_sheet_id
```

## 📊 Expected Data Format

When clips are saved, you'll see data like this:

```
Timestamp: 2025-08-06T07:28:08.830Z
Video ID: NfGaMwOjCXE
Moderator: TechWithJoshi
Command: !clip
Channel: TechWithJoshi
Processed At: 2025-08-06T07:28:10.125Z
Video Title: Live Coding Session
Stream Date: Tue Aug 06 2025
```

## 🧪 Testing the Setup

### Test Manual Clip Creation:

1. Click **"✂️ Manual Clip"** button in the app
2. Enter:
   - **URL**: https://www.youtube.com/watch?v=NfGaMwOjCXE
   - **Start Time**: 1:23:45
   - **Duration**: 30
3. Click **"🎬 Generate Clip"**
4. Check your Google Sheet for new row

### Test Live Chat Integration:

1. Start listening to a live stream
2. Have a moderator type `!clip` in chat
3. Check Google Sheet for automatic entry

## 🚨 Troubleshooting

### Issue: "No Sheet ID found"
**Solution**: Add SHEET_ID to environment variables

### Issue: "Permission denied"
**Solution**: Share sheet with service account email

### Issue: "Invalid Service Account"
**Solution**: Check GOOGLE_SERVICE_ACCOUNT JSON format

### Issue: "Sheet not updating"
**Solution**: 
1. Check console logs for detailed errors
2. Verify service account permissions
3. Test with `/api/setup-sheets` endpoint

## 📱 Integration with Your Workflow

### For TechWithJoshi Streams:
- Set `TWJ_SHEET_ID` environment variable
- All clips automatically go to your specific sheet
- Moderators can use !clip command during live streams

### For Manual Clips:
- Use "✂️ Manual Clip" button anytime
- Perfect for creating clips from old videos
- Supports multiple time formats (1:23:45, 23:45, 145s, 1h23m45s)

---

✅ **Ready to Use!** Your Google Sheet will now automatically collect all clip data with proper formatting! 🎉
