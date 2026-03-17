// StreamVault Backend - Deployment Sync
const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();

app.use(cors()); // Allow website to connect

// 1. Root Endpoint - Just to check if API is working
app.get("/", (req, res) => {
    res.send("StreamVault API is Running Live! 🚀");
});

// Debug Endpoint - To check if files and binaries are correct on Render
app.get("/debug", (req, res) => {
    const fs = require('fs');
    const files = fs.readdirSync('.');
    const ytDlpExists = fs.existsSync('./yt-dlp');
    let ytDlpStats = {};
    if (ytDlpExists) {
        const stats = fs.statSync('./yt-dlp');
        ytDlpStats = {
            size: stats.size,
            mode: stats.mode.toString(8)
        };
    }
    res.json({
        platform: process.platform,
        currentDir: process.cwd(),
        files: files,
        ytDlp: {
            exists: ytDlpExists,
            stats: ytDlpStats
        }
    });
});

// 2. Info Endpoint - Gets video Thumbnail, Title, and Quality options
app.get("/info", (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL) return res.status(400).json({ error: "Paste a URL first" });

    const ytDlpPath = process.platform === "win32" ? "./yt-dlp.exe" : "./yt-dlp";
    console.log(`Using yt-dlp at: ${ytDlpPath} on platform: ${process.platform}`);

    // Extra flags to bypass YouTube bot detection on cloud servers
    const args = [
        "--dump-json",
        "--skip-download",
        "--no-playlist",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--add-header", "Accept-Language:en-US,en;q=0.9",
        "--extractor-args", "youtube:player_client=android,web",
        videoURL
    ];

    const ytDlp = spawn(ytDlpPath, args);

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
        ytDlp.kill();
        if (!res.headersSent) res.status(504).json({ error: "Request timed out. Try again." });
    }, 30000);

    ytDlp.on("error", (err) => {
        clearTimeout(timeout);
        console.error("Failed to start yt-dlp:", err);
        if (!res.headersSent) res.status(500).json({ error: "System error: " + err.message });
    });

    let output = "";
    let errorOutput = "";
    ytDlp.stdout.on("data", (data) => output += data.toString());
    ytDlp.stderr.on("data", (data) => {
        errorOutput += data.toString();
        console.log("yt-dlp stderr:", data.toString());
    });

    ytDlp.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0 || !output.trim()) {
            console.error("yt-dlp closed with code:", code, "Error:", errorOutput);
            if (!res.headersSent) res.status(500).json({ error: "Video info not available. YouTube may be blocking the server." });
            return;
        }

        try {
            const data = JSON.parse(output);
            res.json({
                title: data.title,
                thumbnail: data.thumbnail,
                duration: data.duration_string,
                author: data.uploader,
                formats: data.formats
                    .filter(f => f.ext === 'mp4' || f.format_note === 'tiny' || (f.acodec !== 'none' && f.vcodec === 'none'))
                    .map(f => ({
                        format_id: f.format_id,
                        extension: f.ext,
                        resolution: f.resolution || f.format_note || "Audio only"
                    }))
            });
        } catch (e) {
            res.status(500).json({ error: "Error parsing video info" });
        }
    });
});

// 3. Download Endpoint - Streams the actual video file to the user
app.get("/download", (req, res) => {
    const videoURL = req.query.url;
    const format = req.query.format || "best";

    if (!videoURL) return res.status(400).send("URL is required");

    res.header("Content-Disposition", `attachment; filename="video.mp4"`);
    res.header("Content-Type", "video/mp4");

    const ytDlpPath = process.platform === "win32" ? "./yt-dlp.exe" : "./yt-dlp";
    const args = [
        "-f", format,
        "-o", "-",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--extractor-args", "youtube:player_client=android,web",
        videoURL
    ];

    const ytDlp = spawn(ytDlpPath, args);

    ytDlp.stdout.pipe(res);
    ytDlp.on("error", (err) => console.log("Process error:", err));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));