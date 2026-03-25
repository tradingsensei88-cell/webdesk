from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, HttpUrl, field_validator
from typing import List, Optional
from datetime import datetime, timezone
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
import re
from urllib.parse import urlparse, parse_qs


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', "mongodb://localhost:27017")
db_name = os.environ.get('DB_NAME', "test_database")

db = None
client = None

try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    db = client[db_name]
    # We'll just assume it's connected for now, or check on first request
except Exception as e:
    logging.error(f"Failed to connect to MongoDB: {e}")

app = FastAPI(title="YouTube Transcript API")
api_router = APIRouter(prefix="/api")


class TranscriptSegment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    text: str = Field(..., description="Transcript text for this segment")
    start: float = Field(..., description="Start time in seconds")
    duration: float = Field(..., description="Duration of segment in seconds")


class TranscriptResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    video_id: str = Field(..., description="YouTube video ID")
    language: str = Field(..., description="Transcript language")
    language_code: str = Field(..., description="Language code")
    is_generated: bool = Field(..., description="Whether transcript was auto-generated")
    transcript: List[TranscriptSegment] = Field(..., description="Transcript segments")


class TranscriptRequest(BaseModel):
    video_url: str = Field(..., description="YouTube video URL or ID")
    languages: List[str] = Field(default=["en"], description="Preferred transcript languages")


def extract_video_id(url_or_id: str) -> Optional[str]:
    """Extract YouTube video ID from URL or validate if already an ID"""
    if not url_or_id or not isinstance(url_or_id, str):
        return None
    
    video_id_pattern = r'^[a-zA-Z0-9_-]{11}$'
    if re.match(video_id_pattern, url_or_id):
        return url_or_id
    
    try:
        if not url_or_id.startswith(('http://', 'https://')):
            url_or_id = 'https://' + url_or_id
        
        parsed_url = urlparse(url_or_id)
        
        if 'youtube.com' in parsed_url.netloc:
            if parsed_url.path == '/watch':
                query_params = parse_qs(parsed_url.query)
                video_ids = query_params.get('v', [])
                if video_ids:
                    return video_ids[0]
            elif parsed_url.path.startswith('/embed/'):
                return parsed_url.path.split('/embed/')[1]
            elif parsed_url.path.startswith('/v/'):
                return parsed_url.path.split('/v/')[1].split('?')[0]
        elif 'youtu.be' in parsed_url.netloc:
            video_id = parsed_url.path.lstrip('/')
            return video_id.split('?')[0]
        
        regex_pattern = r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
        match = re.search(regex_pattern, url_or_id)
        if match:
            return match.group(1)
    except Exception:
        pass
    
    return None


@api_router.get("/")
async def root():
    return {"message": "YouTube Transcript API Server"}


@api_router.post("/transcript", response_model=TranscriptResponse)
async def extract_transcript(request: TranscriptRequest):
    """Extract transcript from YouTube video"""
    try:
        video_id = extract_video_id(request.video_url)
        
        if not video_id:
            raise HTTPException(
                status_code=400,
                detail="Invalid YouTube URL or video ID. Please provide a valid YouTube link."
            )
        
        try:
            ytt_api = YouTubeTranscriptApi()
            transcript_list = ytt_api.list(video_id)
            transcript = None
            
            for language_code in request.languages:
                try:
                    transcript = transcript_list.find_transcript([language_code])
                    break
                except NoTranscriptFound:
                    continue
            
            if not transcript:
                available_transcripts = list(transcript_list)
                if available_transcripts:
                    transcript = available_transcripts[0]
                else:
                    raise HTTPException(
                        status_code=404,
                        detail="No transcripts found for this video. The video may not have captions enabled."
                    )
            
            transcript_data = transcript.fetch()
            
            segments = [
                TranscriptSegment(
                    text=item.text if hasattr(item, 'text') else item["text"],
                    start=item.start if hasattr(item, 'start') else item["start"],
                    duration=item.duration if hasattr(item, 'duration') else item["duration"]
                )
                for item in transcript_data
            ]
            
            response = TranscriptResponse(
                video_id=video_id,
                language=transcript.language,
                language_code=transcript.language_code,
                is_generated=transcript.is_generated,
                transcript=segments
            )
            
            return response
            
        except TranscriptsDisabled:
            raise HTTPException(
                status_code=400,
                detail="Transcripts are disabled for this video."
            )
        except VideoUnavailable:
            raise HTTPException(
                status_code=404,
                detail="Video not found or is unavailable."
            )
        except NoTranscriptFound:
            raise HTTPException(
                status_code=404,
                detail="No transcripts available for this video in the requested languages."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Transcript extraction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to extract transcript. Please try again later."
        )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
