const downloadBtn = document.getElementById("downloadBtn");
const mp3Btn = document.getElementById("mp3Btn");
const urlInput = document.getElementById("urlInput");
const statusMessage = document.getElementById("statusMessage");
const previewCard = document.getElementById("previewCard");
const qualitySelection = document.getElementById("qualitySelection");
const formatSelect = document.getElementById("formatSelect");
const audioFormatSelect = document.getElementById("audioFormatSelect");
const actionButtons = document.getElementById("actionButtons");
// Switch between Local and Live Server automatically
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === ""
    ? "http://localhost:5000" 
    : "https://yt-video-downloader-2xka.onrender.com";

let debounceTimer;

// Helper to show messages (Success or Error)
function showStatus(text, isError = false) {
    statusMessage.textContent = text;
    statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
}

// Logic to detect when user pastes a link
function handleUrlChange() {
    clearTimeout(debounceTimer);
    const url = urlInput.value.trim();

    if (!url || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
        previewCard.classList.add("hidden");
        qualitySelection.classList.add("hidden");
        actionButtons.classList.add("hidden");
        return;
    }

    // Wait 0.8s after typing stops to fetch info
    debounceTimer = setTimeout(() => fetchVideoInfo(url), 800);
}

// Fetches Thumbnail and Quality from Backend
async function fetchVideoInfo(url) {
    showStatus("Fetching video details...");
    
    try {
        const response = await fetch(`${BACKEND_URL}/info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.error) return showStatus(data.error, true);

        // Update Preview Details
        document.getElementById("videoThumbnail").src = data.thumbnail;
        document.getElementById("videoTitle").textContent = data.title;
        document.getElementById("videoAuthor").textContent = data.author;
        document.getElementById("videoDuration").textContent = data.duration;

        // Populate Video Quality Menu
        formatSelect.innerHTML = '<option value="best">🎬 Best Quality (Default)</option>';
        data.formats
            .filter(f => f.type === "video")
            .forEach(f => {
                const option = document.createElement("option");
                option.value = f.format_id;
                let resText = f.resolution;
                if (!resText || resText === "Video") resText = "Original Video";
                option.textContent = `📺 ${resText} (${f.extension})`;
                formatSelect.appendChild(option);
            });

        // Populate Audio Quality Menu
        audioFormatSelect.innerHTML = `
            <option value="best">🔥 High Quality (320kbps) - Default</option>
            <option value="best">⚡ Standard (128kbps)</option>
        `;
        data.formats
            .filter(f => f.type === "audio")
            .forEach(f => {
                const option = document.createElement("option");
                option.value = f.format_id;
                // Prettify the resolution string
                let resText = f.resolution;
                if (!resText || resText === "Audio only") resText = "Original Audio";
                option.textContent = `🎵 ${resText} (${f.extension})`;
                audioFormatSelect.appendChild(option);
            });

        previewCard.classList.remove("hidden");
        qualitySelection.classList.remove("hidden");
        actionButtons.classList.remove("hidden");
        showStatus("Ready to download!");

    } catch (error) {
        showStatus("Server not responding. Check if backend is running.", true);
    }
}

// Starts video download
function downloadVideo() {
    const url = urlInput.value.trim();
    if (!url) return showStatus("Paste a link first!", true);

    const format = formatSelect.value;
    const originalContent = downloadBtn.innerHTML;

    downloadBtn.classList.add("loading");
    downloadBtn.innerHTML = `<div class="spinner"></div> <span>Downloading...</span>`;
    showStatus("Video download started! Check your folder.");

    window.location.href = `${BACKEND_URL}/download?url=${encodeURIComponent(url)}&format=${format}&type=video`;

    setTimeout(() => {
        downloadBtn.classList.remove("loading");
        downloadBtn.innerHTML = originalContent;
        if (window.lucide) lucide.createIcons();
    }, 4000);
}

// Starts MP3 download
function downloadMp3() {
    const url = urlInput.value.trim();
    if (!url) return showStatus("Paste a link first!", true);

    const originalContent = mp3Btn.innerHTML;

    mp3Btn.classList.add("loading");
    mp3Btn.innerHTML = `<div class="spinner"></div>`;
    showStatus("MP3 download started! Check your folder.");

    const format = audioFormatSelect.value;
    window.location.href = `${BACKEND_URL}/download?url=${encodeURIComponent(url)}&format=${format}&type=audio`;

    setTimeout(() => {
        mp3Btn.classList.remove("loading");
        mp3Btn.innerHTML = originalContent;
        if (window.lucide) lucide.createIcons();
    }, 4000);
}

// Press 'Enter' key to download video
urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") downloadVideo();
});
