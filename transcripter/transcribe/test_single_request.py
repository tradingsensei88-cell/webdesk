import requests
import json

# Test with a simple request to see detailed error
url = "https://yt-transcript-2.preview.emergentagent.com/api/transcript"
data = {
    "video_url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    "languages": ["en"]
}

try:
    response = requests.post(url, json=data, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")