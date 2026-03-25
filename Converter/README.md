# FileForge — Premium File Converter

A full-stack file conversion web application with a Wakanda-inspired dark luxury UI and a production-ready Python/Flask backend.

## Supported Conversions

| Conversion    | Library Used                        |
|---------------|-------------------------------------|
| PDF → Word    | `pdf2docx`                          |
| Word → PDF    | `docx2pdf` (Windows) / LibreOffice  |
| PPT → PDF     | LibreOffice headless                |
| PDF → JPG     | `pdf2image` + Poppler               |
| Image → PDF   | `Pillow`                            |
| PDF → PPT     | `pdf2image` + `python-pptx`         |
| Merge PDF     | `PyPDF2`                            |
| Compress PDF  | `PyPDF2`                            |

## Prerequisites

- **Python 3.9+**
- **Poppler** (required for PDF → Image and PDF → PPT)
- **LibreOffice** (required for DOCX → PDF on Linux and PPT → PDF)

### Install Poppler

**Windows:**
1. Download from https://github.com/oschwartz10612/poppler-windows/releases
2. Extract to `C:\poppler`
3. Add `C:\poppler\Library\bin` to your system PATH

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install poppler-utils
```

**macOS:**
```bash
brew install poppler
```

### Install LibreOffice (for DOCX→PDF & PPT→PDF)

**Windows:** Download from https://www.libreoffice.org/download  
**Linux:**
```bash
sudo apt-get install libreoffice
```

## Quick Start

```bash
# 1. Clone / navigate to the project
cd PDF

# 2. Create virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the server
python app.py
```

Open **http://localhost:5000** in your browser.

## Project Structure

```
PDF/
├── app.py                  # Flask backend (all routes)
├── requirements.txt        # Python dependencies
├── README.md               # This file
├── static/
│   ├── index.html          # Main SPA page
│   ├── css/
│   │   └── style.css       # Wakanda design system
│   └── js/
│       └── app.js          # Interactions, particles, upload
├── uploads/                # Temp (auto-created, auto-cleaned)
├── converted/              # Temp (auto-created, auto-cleaned)
└── logs/
    └── fileforge.log       # Server logs
```

## Deployment

### Render

1. Create a `Procfile`: `web: gunicorn app:app --bind 0.0.0.0:$PORT`
2. Add `gunicorn` to `requirements.txt`
3. Set build command: `pip install -r requirements.txt && apt-get update && apt-get install -y poppler-utils libreoffice`
4. Push to GitHub and connect to Render

### Railway

1. Connect your GitHub repo
2. Set start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
3. Add Nixpacks config for poppler and libreoffice

### Linux VPS

```bash
sudo apt update && sudo apt install -y python3-pip poppler-utils libreoffice
git clone <your-repo> && cd <your-repo>
pip3 install -r requirements.txt gunicorn
gunicorn app:app --bind 0.0.0.0:5000 --workers 4
```

Use Nginx as reverse proxy + systemd for process management.

## API Endpoints

All POST routes accept `multipart/form-data` with field name `file` (or `files` for merge).

| Endpoint                      | Method | Description       |
|-------------------------------|--------|-------------------|
| `/`                           | GET    | Serve frontend    |
| `/health`                     | GET    | Health check      |
| `/api/convert/pdf-to-docx`    | POST   | PDF → DOCX        |
| `/api/convert/docx-to-pdf`    | POST   | DOCX → PDF        |
| `/api/convert/ppt-to-pdf`     | POST   | PPT → PDF         |
| `/api/convert/pdf-to-image`   | POST   | PDF → JPG/ZIP     |
| `/api/convert/image-to-pdf`   | POST   | Image → PDF       |
| `/api/convert/pdf-to-ppt`     | POST   | PDF → PPTX        |
| `/api/convert/merge-pdf`      | POST   | Merge PDFs        |
| `/api/convert/compress-pdf`   | POST   | Compress PDF      |
