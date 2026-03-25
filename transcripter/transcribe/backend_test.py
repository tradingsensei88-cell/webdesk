import requests
import sys
import json
from datetime import datetime

class YouTubeTranscriptAPITester:
    def __init__(self, base_url="https://yt-transcript-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test_result(self, name, success, details=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details or {}
        }
        self.test_results.append(result)

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.content else {}
                except:
                    response_data = {"raw_response": response.text[:200]}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    response_data = response.json() if response.content else {}
                    print(f"   Error Response: {response_data}")
                except:
                    response_data = {"error": response.text[:200]}

            self.log_test_result(name, success, {
                "status_code": response.status_code,
                "expected_status": expected_status,
                "response_data": response_data,
                "request_data": data
            })

            return success, response_data

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            self.log_test_result(name, False, {"error": "Request timeout"})
            return False, {"error": "timeout"}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.log_test_result(name, False, {"error": str(e)})
            return False, {"error": str(e)}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )

    def test_transcript_extraction_valid_url(self):
        """Test transcript extraction with valid YouTube URL"""
        test_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
        success, response = self.run_test(
            "Transcript Extraction - Valid URL",
            "POST",
            "transcript",
            200,
            data={
                "video_url": test_url,
                "languages": ["en"]
            }
        )
        
        if success and response:
            # Verify response structure
            required_fields = ["video_id", "language", "language_code", "is_generated", "transcript"]
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"⚠️  Warning: Missing fields in response: {missing_fields}")
            
            if "transcript" in response and isinstance(response["transcript"], list):
                if len(response["transcript"]) > 0:
                    segment = response["transcript"][0]
                    segment_fields = ["text", "start", "duration"]
                    missing_segment_fields = [field for field in segment_fields if field not in segment]
                    if missing_segment_fields:
                        print(f"⚠️  Warning: Missing fields in transcript segment: {missing_segment_fields}")
                    else:
                        print(f"✅ Transcript contains {len(response['transcript'])} segments")
                else:
                    print("⚠️  Warning: Transcript is empty")
        elif not success:
            # Debug the actual response
            print(f"   Debug - actual response received: {response}")
        
        return success

    def test_transcript_extraction_invalid_url(self):
        """Test transcript extraction with invalid YouTube URL"""
        return self.run_test(
            "Transcript Extraction - Invalid URL",
            "POST",
            "transcript",
            400,
            data={
                "video_url": "https://invalid-url.com/watch?v=invalid",
                "languages": ["en"]
            }
        )[0]

    def test_transcript_extraction_nonexistent_video(self):
        """Test transcript extraction with non-existent YouTube video"""
        return self.run_test(
            "Transcript Extraction - Non-existent Video",
            "POST",
            "transcript",
            404,
            data={
                "video_url": "https://www.youtube.com/watch?v=AAAAAAAAAAA",
                "languages": ["en"]
            }
        )[0]

    def test_transcript_extraction_no_url(self):
        """Test transcript extraction without URL"""
        return self.run_test(
            "Transcript Extraction - Missing URL",
            "POST",
            "transcript",
            422,  # Validation error
            data={
                "languages": ["en"]
            }
        )[0]

    def test_transcript_extraction_empty_url(self):
        """Test transcript extraction with empty URL"""
        return self.run_test(
            "Transcript Extraction - Empty URL",
            "POST",
            "transcript",
            400,
            data={
                "video_url": "",
                "languages": ["en"]
            }
        )[0]

    def test_short_youtube_url(self):
        """Test transcript extraction with short YouTube URL"""
        return self.run_test(
            "Transcript Extraction - Short YouTube URL",
            "POST",
            "transcript",
            200,
            data={
                "video_url": "https://youtu.be/jNQXAC9IVRw",
                "languages": ["en"]
            }
        )[0]

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting YouTube Transcript API Tests...")
        print(f"Testing API at: {self.api_url}")
        
        # Test basic connectivity
        self.test_root_endpoint()
        
        # Test transcript extraction functionality
        self.test_transcript_extraction_valid_url()
        self.test_short_youtube_url()
        
        # Test error handling
        self.test_transcript_extraction_invalid_url()
        self.test_transcript_extraction_nonexistent_video()
        self.test_transcript_extraction_no_url()
        self.test_transcript_extraction_empty_url()
        
        # Print final results
        print(f"\n📊 Backend Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("✅ All backend tests passed!")
            return 0
        else:
            print("❌ Some backend tests failed")
            failed_tests = [result for result in self.test_results if not result["success"]]
            print(f"\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test_name']}: {test['details'].get('error', 'Unknown error')}")
            return 1

def main():
    tester = YouTubeTranscriptAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())