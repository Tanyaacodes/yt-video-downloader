require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// =============================================
// Settings are now loaded from .env file
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
// =============================================
const RAPIDAPI_HOST = "yt-api.p.rapidapi.com";

// 1. Root Endpoint
app.get("/", (req, res) => {
    res.send("StreamVault API is Running Live! 🚀 (New API)");
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
            `https://${RAPIDAPI_HOST}/dl?id=${videoId}`,
            {
                method: "GET",
                headers: {
                    "x-rapidapi-key": RAPIDAPI_KEY,
                    "x-rapidapi-host": RAPIDAPI_HOST
                }
            }
        );

        const data = await response.json();

        if (!data || data.status !== "OK" || !data.title) {
            return res.status(500).json({ error: "Could not fetch video info: " + (data.msg || "Unknown error") });
        }

        // Build formats list for frontend
        const formatsList = [];

        // 1. Regular Formats (Usually video + audio combined)
        if (data.formats) {
            data.formats.forEach(f => {
                const mimeType = f.mimeType || "";
                if (mimeType.includes("video/mp4")) {
                    formatsList.push({
                        format_id: String(f.itag),
                        extension: "mp4",
                        resolution: f.qualityLabel || "MP4 Normal",
                        type: "video"
                    });
                }
            });
        }

        // 2. Adaptive Formats (Usually separate streams)
        if (data.adaptiveFormats) {
            data.adaptiveFormats.forEach(f => {
                const mimeType = f.mimeType || "";
                // Capture audio only (usually mp4a)
                if (mimeType.includes("audio/")) {
                    formatsList.push({
                        format_id: String(f.itag),
                        extension: "mp3",
                        resolution: (f.audioQuality || "128kbps").replace("AUDIO_QUALITY_", ""),
                        type: "audio"
                    });
                }
                // Capture high res videos if not in regular formats
                else if (mimeType.includes("video/mp4") && !formatsList.some(ex => ex.resolution === f.qualityLabel)) {
                     formatsList.push({
                        format_id: String(f.itag),
                        extension: "mp4",
                        resolution: f.qualityLabel || "HD",
                        type: "video"
                    });
                }
            });
        }

        const durationSec = parseInt(data.lengthSeconds);
        const durationStr = !isNaN(durationSec) ? `${Math.floor(durationSec/60)}:${(durationSec%60).toString().padStart(2, '0')}` : "";
        const thumbnail = data.thumbnail && data.thumbnail.length > 0 ? data.thumbnail[data.thumbnail.length - 1].url : "";

        res.json({
            title: data.title,
            thumbnail: thumbnail,
            duration: durationStr,
            author: data.author || "",
            formats: formatsList
        });

    } catch (err) {
        console.error("RapidAPI error:", err);
        res.status(500).json({ error: "Server error: " + err.message });
    }
});

// 3. Download Endpoint - Redirects to direct download URL
app.get("/download", async (req, res) => {
    const videoURL = req.query.url;
    const formatItag = req.query.format;
    const type = req.query.type || "video"; // "video" or "audio"

    if (!videoURL) return res.status(400).send("URL is required");

    const videoIdMatch = videoURL.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
    if (!videoIdMatch) return res.status(400).send("Invalid YouTube URL");
    const videoId = videoIdMatch[1];

    try {
        const response = await fetch(
            `https://${RAPIDAPI_HOST}/dl?id=${videoId}`,
            {
                method: "GET",
                headers: {
                    "x-rapidapi-key": RAPIDAPI_KEY,
                    "x-rapidapi-host": RAPIDAPI_HOST
                }
            }
        );

        const data = await response.json();
        if (data.status !== "OK") return res.status(500).send("Cloud API failed");

        let downloadUrl = null;

        // Find itag specific format
        const allFormats = [...(data.formats || []), ...(data.adaptiveFormats || [])];
        
        if (formatItag && formatItag !== "best") {
            const found = allFormats.find(f => String(f.itag) === formatItag);
            if (found) downloadUrl = found.url;
        }

        // Fallback to best quality if not found or "best"
        if (!downloadUrl) {
            if (type === "audio") {
                const audios = (data.adaptiveFormats || []).filter(f => f.mimeType.includes("audio/"));
                if (audios.length > 0) downloadUrl = audios[0].url;
            } else {
                const videos = (data.formats || []).filter(f => f.mimeType.includes("video/mp4"));
                if (videos.length > 0) downloadUrl = videos[0].url;
            }
        }

        if (!downloadUrl) return res.status(500).send("Download link not available for this video.");

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