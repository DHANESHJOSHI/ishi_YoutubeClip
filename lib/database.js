import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

// Clip schema helper functions
export async function getClipsCollection() {
  const client = await clientPromise;
  const db = client.db('youtube_clips');
  return db.collection('clips');
}

export async function saveClip(clipData) {
  const collection = await getClipsCollection();
  return await collection.insertOne({
    ...clipData,
    createdAt: new Date(),
    downloadLink: generateDownloadLink(clipData.timestamp, clipData.videoId)
  });
}

export async function getClips(videoId) {
  const collection = await getClipsCollection();
  return await collection.find({ videoId }).sort({ createdAt: -1 }).toArray();
}

function generateDownloadLink(timestamp, videoId, channelId = null, channelName = null) {
  // Generate download link with timestamp (30 seconds BEFORE the timestamp)
  const clipTimestamp = new Date(timestamp);
  const startTime = new Date(clipTimestamp.getTime() - 30000); // 30 seconds BEFORE
  const endTime = new Date(clipTimestamp.getTime()); // End at the timestamp
  
  const params = new URLSearchParams({
    videoId,
    start: startTime.toISOString(),
    end: endTime.toISOString()
  });

  if (channelId) params.append('channelId', channelId);
  if (channelName) params.append('channelName', channelName);
  
  return {
    // New direct download endpoint with yt-dlp support
    url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/download-direct?${params.toString()}`,
    // Fallback to old endpoint
    fallbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/download?${params.toString()}`,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  };
}
