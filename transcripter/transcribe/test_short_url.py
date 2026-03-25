import requests
import json

# Test with short URL
url = "https://yt-transcript-2.preview.emergentagent.com/api/transcript"
data = {
    "video_url": "https://youtu.be/jNQXAC9IVRw",
    "languages": ["en"]
}

try:
    response = requests.post(url, json=data, timeout=30)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"Error: {e}")