import { getClips, getClipsCollection, saveClip } from "../../../lib/database.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const clipData = req.body;

      if (!clipData.videoId || !clipData.timestamp) {
        return res.status(400).json({ message: "VideoId and timestamp are required" });
      }

      const result = await saveClip(clipData);
      
      return res.json({
        success: true,
        clipId: result.insertedId,
        message: "Clip saved successfully"
      });

    } catch (err) {
      console.error("Save clip error:", err.message);
      return res.status(500).json({ 
        error: "Failed to save clip", 
        details: err.message 
      });
    }

  } else if (req.method === "GET") {
    try {
      const { videoId } = req.query;

      if (!videoId) {
        return res.status(400).json({ message: "VideoId is required" });
      }

      const allClips = await getClips(videoId);
      
      // Filter clips to show only those created after bot start time
      const session = global.activeSessions?.get(videoId);
      const clips = session?.startTime 
        ? allClips.filter(clip => new Date(clip.timestamp) >= session.startTime)
        : allClips;
      
      // Disable caching for real-time clip updates
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      return res.json({
        success: true,
        videoId,
        totalClips: clips.length,
        timestamp: new Date().toISOString(),
        clips: clips.map(clip => ({
          id: clip._id,
          timestamp: clip.timestamp,
          moderator: clip.moderator,
          command: clip.command,
          createdAt: clip.createdAt,
          downloadLink: clip.downloadLink
        }))
      });

    } catch (err) {
      console.error("Get clips error:", err.message);
      return res.status(500).json({ 
        error: "Failed to fetch clips", 
        details: err.message 
      });
    }

  } else if (req.method === "DELETE") {
    try {
      const { clipId } = req.query;

      if (!clipId) {
        return res.status(400).json({ message: "ClipId is required" });
      }

      const collection = await getClipsCollection();
      const result = await collection.deleteOne({ _id: clipId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Clip not found" });
      }

      return res.json({ 
        success: true, 
        message: "Clip deleted successfully" 
      });

    } catch (err) {
      console.error("Delete clip error:", err.message);
      return res.status(500).json({ 
        error: "Failed to delete clip", 
        details: err.message 
      });
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
