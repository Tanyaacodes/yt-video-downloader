const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();

app.use(cors()); // Allow website to connect

// 1. Root Endpoint - Just to check if API is working
app.get("/", (req, res) => {
    res.send("YouTube Downloader API is Running! 🚀");
});

// 2. Info Endpoint - Gets video Thumbnail, Title, and Quality options
app.get("/info", (req, res) => {
    const videoURL = req.query.url;
    if (!videoURL) return res.status(400).json({ error: "Paste a URL first" });

    // We use yt-dlp to 'dump' video information in JSON format
    // Cross-platform yt-dlp path
    const ytDlpPath = process.platform === "win32" ? "./yt-dlp.exe" : "./yt-dlp";
    console.log(`Using yt-dlp at: ${ytDlpPath} on platform: ${process.platform}`);
    const ytDlp = spawn(ytDlpPath, ["--dump-json", "--skip-download", videoURL]);

    ytDlp.on("error", (err) => {
        console.error("Failed to start yt-dlp:", err);
        if (!res.headersSent) res.status(500).json({ error: "System error: " + err.message });
    });

    let output = "";
    let errorOutput = "";
    ytDlp.stdout.on("data", (data) => output += data.toString());
    ytDlp.stderr.on("data", (data) => errorOutput += data.toString());

    ytDlp.on("close", (code) => {
        if (code !== 0 || !output.trim()) {
            console.error("yt-dlp closed with code:", code, "Error:", errorOutput);
            if (!res.headersSent) res.status(500).json({ error: "Video info not available" });
            return;
        }

        try {
            const data = JSON.parse(output);
            res.json({
                title: data.title,
                thumbnail: data.thumbnail,
                duration: data.duration_string,
                author: data.uploader,
                // We filter useful formats (video + audio)
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

    // Tell the browser that a file is being downloaded
    res.header("Content-Disposition", `attachment; filename="video.mp4"`);
    res.header("Content-Type", "video/mp4");

    const ytDlpPath = process.platform === "win32" ? "./yt-dlp.exe" : "./yt-dlp";
    const ytDlp = spawn(ytDlpPath, ["-f", format, "-o", "-", videoURL]);

    // Pipe the data directly to the user's browser
    ytDlp.stdout.pipe(res);

    ytDlp.on("error", (err) => console.log("Process error:", err));
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));