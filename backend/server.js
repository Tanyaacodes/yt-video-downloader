// StreamVault Backend - RapidAPI Version
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// =============================================
// 🔑 REPLACE YOUR RAPIDAPI KEY HERE
const RAPIDAPI_KEY = "4956c10e1fmsh9ac28e64f0c8e48p1b6255jsn480e344d510a";
// =============================================
const RAPIDAPI_HOST = "youtube-media-downloader.p.rapidapi.com";

// 1. Root Endpoint
app.get("/", (req, res) => {
    res.send("StreamVault API is Running Live! 🚀");
});

// 2. Info Endpoint - Gets video Thumbnail, Title, and Quality options
app.get("/info", async (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL) return res.status(400).json({ error: "Paste a URL first" });

    // Extract video ID from URL
    const videoIdMatch = videoURL.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
    if (!videoIdMatch) return res.status(400).json({ error: "Invalid YouTube URL" });
    const videoId = videoIdMatch[1];

    try {
        const response = await fetch(
            `https://${RAPIDAPI_HOST}/v2/video/details?videoId=${videoId}`,
            {
                headers: {
                    // 🔑 API KEY IS USED HERE
                    "x-rapidapi-key": RAPIDAPI_KEY,
                    "x-rapidapi-host": RAPIDAPI_HOST,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!data || data.status === false) {
            return res.status(500).json({ error: "Could not fetch video info" });
        }

        // Build formats list for video
        const formats = [];

        // Add video formats
        if (data.videos && data.videos.items) {
            data.videos.items.forEach(v => {
                formats.push({
                    format_id: v.url,
                    extension: "mp4",
                    resolution: v.quality || v.qualityLabel || "Video",
                    type: "video"
                });
            });
        }

        // Add audio formats
        if (data.audios && data.audios.items) {
            data.audios.items.forEach(a => {
                formats.push({
                    format_id: a.url,
                    extension: "mp3",
                    resolution: "Audio only",
                    type: "audio"
                });
            });
        }

        res.json({
            title: data.title,
            thumbnail: data.thumbnail?.url || data.thumbnails?.[0]?.url || "",
            duration: data.lengthText || "",
            author: data.channelTitle || data.author || "",
            formats: formats
        });

    } catch (err) {
        console.error("RapidAPI error:", err);
        res.status(500).json({ error: "Server error: " + err.message });
    }
});

// 3. Download Endpoint - Redirects to direct download URL
app.get("/download", async (req, res) => {
    const videoURL = req.query.url;
    const format = req.query.format;
    const type = req.query.type || "video"; // "video" or "audio"

    if (!videoURL) return res.status(400).send("URL is required");

    const videoIdMatch = videoURL.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
    if (!videoIdMatch) return res.status(400).send("Invalid YouTube URL");
    const videoId = videoIdMatch[1];

    try {
        const response = await fetch(
            `https://${RAPIDAPI_HOST}/v2/video/details?videoId=${videoId}`,
            {
                headers: {
                    // 🔑 API KEY IS USED HERE
                    "x-rapidapi-key": RAPIDAPI_KEY,
                    "x-rapidapi-host": RAPIDAPI_HOST,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        let downloadUrl = null;

        if (type === "audio") {
            // Get best audio
            if (data.audios && data.audios.items && data.audios.items.length > 0) {
                downloadUrl = data.audios.items[0].url;
            }
        } else {
            // Get selected video format or best
            if (data.videos && data.videos.items) {
                if (format && format !== "best") {
                    const found = data.videos.items.find(v => v.url === format);
                    downloadUrl = found ? found.url : data.videos.items[0].url;
                } else {
                    downloadUrl = data.videos.items[0].url;
                }
            }
        }

        if (!downloadUrl) return res.status(500).send("Download URL not found");

        // Set filename
        const filename = type === "audio" ? "audio.mp3" : "video.mp4";
        res.header("Content-Disposition", `attachment; filename="${filename}"`);

        // Redirect to direct URL
        res.redirect(downloadUrl);

    } catch (err) {
        console.error("Download error:", err);
        res.status(500).send("Server error: " + err.message);
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));