const downloadBtn = document.getElementById("downloadBtn");
const urlInput = document.getElementById("urlInput");
const statusMessage = document.getElementById("statusMessage");
const previewCard = document.getElementById("previewCard");
const qualitySelection = document.getElementById("qualitySelection");
const formatSelect = document.getElementById("formatSelect");

// Switch between Local and Live Server automatically
const BACKEND_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
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

        // Populate Quality Menu
        formatSelect.innerHTML = '<option value="best">Best Quality (Default)</option>';
        data.formats.forEach(f => {
            const option = document.createElement("option");
            option.value = f.format_id;
            option.textContent = `${f.resolution} (${f.extension})`;
            formatSelect.appendChild(option);
        });

        previewCard.classList.remove("hidden");
        qualitySelection.classList.remove("hidden");
        showStatus("Ready to download!");

    } catch (error) {
        showStatus("Server not responding. Check if backend is running.", true);
    }
}

// Starts the actual download
function downloadVideo() {
    const url = urlInput.value.trim();
    if (!url) return showStatus("Paste a link first!", true);

    const format = formatSelect.value;
    const originalContent = downloadBtn.innerHTML;

    // Show Loading Animation
    downloadBtn.classList.add("loading");
    downloadBtn.innerHTML = `<div class="spinner"></div> <span>Downloading...</span>`;
    showStatus("Download started! Check your folder.");

    // Redirect to download link
    window.location.href = `${BACKEND_URL}/download?url=${encodeURIComponent(url)}&format=${format}`;

    // Reset button after 4 seconds
    setTimeout(() => {
        downloadBtn.classList.remove("loading");
        downloadBtn.innerHTML = originalContent;
        if (window.lucide) lucide.createIcons();
    }, 4000);
}

// Press 'Enter' key to search/download
urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") downloadVideo();
});