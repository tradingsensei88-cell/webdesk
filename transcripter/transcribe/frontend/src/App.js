import { useState } from "react";
import "@/App.css";
import axios from "axios";
import { Search, Copy, Download, Check, Youtube } from "lucide-react";
import { Toaster, toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [videoId, setVideoId] = useState("");

  const extractVideoId = (url) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : url;
  };

  const handleExtractTranscript = async () => {
    if (!videoUrl.trim()) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/transcript`, {
        video_url: videoUrl,
        languages: ["en"]
      });

      setTranscript(response.data);
      setVideoId(response.data.video_id);
      setActiveIndex(null);
      toast.success("Transcript extracted successfully!");
    } catch (error) {
      console.error("Error extracting transcript:", error);
      const errorMsg = error.response?.data?.detail || "Failed to extract transcript";
      toast.error(errorMsg);
      setTranscript(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTranscript = () => {
    if (!transcript) return;

    const text = transcript.transcript
      .map(segment => `[${formatTime(segment.start)}] ${segment.text}`)
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    if (!transcript) return;

    const text = transcript.transcript
      .map(segment => `[${formatTime(segment.start)}] ${segment.text}`)
      .join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${transcript.video_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded!");
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleTimestampClick = (startTime) => {
    const iframe = document.querySelector("iframe");
    if (iframe) {
      const currentSrc = iframe.src;
      const newSrc = currentSrc.split("?")[0] + `?start=${Math.floor(startTime)}&autoplay=1`;
      iframe.src = newSrc;
    }
  };

  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      
      {/* Background texture */}
      <div className="background-texture" />

      {!transcript ? (
        <div className="hero-section" data-testid="hero-section">
          <div className="hero-content">
            <div className="glow-orb" />
            <h1 className="hero-title" data-testid="app-title">
              <span className="title-primary">Echo</span>
              <span className="title-subtitle">YouTube Transcript Extractor</span>
            </h1>
            <p className="hero-description" data-testid="hero-description">
              Extract video transcripts with precise timestamps. Perfect for content creators, students, and researchers.
            </p>

            <div className="input-container" data-testid="url-input-container">
              <div className="input-wrapper">
                <Youtube className="input-icon" />
                <input
                  type="text"
                  className="url-input"
                  data-testid="video-url-input"
                  placeholder="Paste YouTube URL here..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleExtractTranscript()}
                />
              </div>
              <button
                className="extract-button"
                data-testid="extract-button"
                onClick={handleExtractTranscript}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-spinner">Extracting...</span>
                ) : (
                  <>
                    <Search className="button-icon" />
                    Extract Transcript
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="app-shell" data-testid="transcript-view">
          <div className="app-header" data-testid="app-header">
            <div className="header-content">
              <button
                className="back-button"
                data-testid="back-button"
                onClick={() => {
                  setTranscript(null);
                  setVideoUrl("");
                  setVideoId("");
                }}
              >
                ← Back
              </button>
              <div className="header-info">
                <h2 className="header-title">Echo</h2>
                <span className="header-lang" data-testid="transcript-language">
                  {transcript.language} {transcript.is_generated && "(Auto-generated)"}
                </span>
              </div>
            </div>
            <div className="header-actions">
              <button
                className="action-button"
                data-testid="copy-button"
                onClick={handleCopyTranscript}
              >
                {copied ? <Check className="action-icon" /> : <Copy className="action-icon" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                className="action-button"
                data-testid="download-button"
                onClick={handleDownloadTranscript}
              >
                <Download className="action-icon" />
                Download
              </button>
            </div>
          </div>

          <div className="content-grid">
            <div className="left-panel">
              <div className="video-container" data-testid="video-container">
                <iframe
                  className="video-player"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            <div className="right-panel" data-testid="transcript-container">
              <div className="transcript-header">
                <h3 className="transcript-title">Transcript</h3>
                <span className="transcript-count" data-testid="segment-count">
                  {transcript.transcript.length} segments
                </span>
              </div>
              <div className="transcript-list">
                {transcript.transcript.map((segment, index) => (
                  <div
                    key={index}
                    className={`transcript-item ${activeIndex === index ? "active" : ""}`}
                    data-testid={`transcript-segment-${index}`}
                    onClick={() => {
                      setActiveIndex(index);
                      handleTimestampClick(segment.start);
                    }}
                  >
                    <span className="timestamp" data-testid={`timestamp-${index}`}>
                      {formatTime(segment.start)}
                    </span>
                    <p className="segment-text" data-testid={`segment-text-${index}`}>
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
