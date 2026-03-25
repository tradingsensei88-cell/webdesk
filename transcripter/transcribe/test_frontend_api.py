import requests
import json
import time

# Test the exact same request as frontend with proper headers
url = "https://yt-transcript-2.preview.emergentagent.com/api/transcript"
headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

data = {
    "video_url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    "languages": ["en"]
}

print("Testing API call with frontend-like request...")

for i in range(3):
    print(f"\nAttempt {i+1}:")
    try:
        response = requests.post(url, json=data, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Success! Video ID: {result.get('video_id')}, Segments: {len(result.get('transcript', []))}")
            break
        else:
            print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
    
    if i < 2:  # Don't sleep after last attempt
        time.sleep(2)