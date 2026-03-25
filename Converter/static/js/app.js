/* ============================================
   FILEFORGE — INTERACTIVE JS
   ============================================ */

(function () {
    'use strict';

    // ---- Config ----
    const API_BASE = '';
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    const MIME_MAP = {
        'pdf-to-docx': { accept: ['application/pdf'], ext: ['.pdf'], label: 'PDF' },
        'docx-to-pdf': { accept: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'], ext: ['.docx', '.doc'], label: 'Word' },
        'ppt-to-pdf': { accept: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'], ext: ['.pptx', '.ppt'], label: 'PPT' },
        'image-to-pdf': { accept: ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'], ext: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'], label: 'Image', multi: true },
        'pdf-to-ppt': { accept: ['application/pdf'], ext: ['.pdf'], label: 'PDF' },
        'pdf-to-image': { accept: ['application/pdf'], ext: ['.pdf'], label: 'PDF' },
        'merge-pdf': { accept: ['application/pdf'], ext: ['.pdf'], label: 'PDF', multi: true },
        'compress-pdf': { accept: ['application/pdf'], ext: ['.pdf'], label: 'PDF' },
    };

    // ---- DOM Refs ----
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const navbar = $('#navbar');
    const navToggle = $('#nav-toggle');
    const navLinks = $('.nav-links');
    const convType = $('#conversion-type');
    const dropZone = $('#drop-zone');
    const fileInput = $('#file-input');
    const filePreview = $('#file-preview');
    const fileName = $('#file-name');
    const fileSize = $('#file-size');
    const fileRemove = $('#file-remove');
    const multiList = $('#multi-file-list');
    const multiItems = $('#multi-file-items');
    const btnAddMore = $('#btn-add-more');
    const btnConvert = $('#btn-convert');
    const progressCont = $('#progress-container');
    const progressBar = $('#progress-bar');
    const progressText = $('#progress-text');
    const progressLabel = $('#progress-label');
    const statusMsg = $('#status-message');
    const canvas = $('#particles-canvas');

    // ---- State ----
    let selectedFiles = [];
    let isConverting = false;

    // ======================
    // PARTICLES SYSTEM
    // ======================
    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 60;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.4 + 0.1;
            this.pulse = Math.random() * Math.PI * 2;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.pulse += 0.02;
            if (this.x < -10 || this.x > canvas.width + 10 ||
                this.y < -10 || this.y > canvas.height + 10) {
                this.reset();
            }
        }
        draw() {
            const alpha = this.opacity + Math.sin(this.pulse) * 0.15;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(157, 78, 221, ${Math.max(0, alpha)})`;
            ctx.fill();
            // glow
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(123, 44, 191, ${Math.max(0, alpha * 0.15)})`;
            ctx.fill();
        }
    }

    function initParticles() {
        resizeCanvas();
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(123, 44, 191, ${0.08 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animateParticles);
    }

    window.addEventListener('resize', resizeCanvas);
    initParticles();
    animateParticles();

    // ======================
    // NAVBAR
    // ======================
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        updateActiveNav();
    });

    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
    });

    // Close mobile menu on link click
    $$('.nav-link').forEach(link => {
        link.addEventListener('click', () => navLinks.classList.remove('open'));
    });

    function updateActiveNav() {
        const sections = ['hero', 'tools', 'convert', 'features'];
        let current = '';
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el && window.scrollY >= el.offsetTop - 200) current = id;
        });
        $$('.nav-link').forEach(l => {
            l.classList.toggle('active', l.getAttribute('href') === `#${current}`);
        });
    }

    // ======================
    // SCROLL REVEAL
    // ======================
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    $$('.reveal').forEach(el => observer.observe(el));

    // ======================
    // RIPPLE EFFECT
    // ======================
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.btn-cta, .btn-convert, .tool-card');
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
        target.style.position = 'relative';
        target.style.overflow = 'hidden';
        target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });

    // ======================
    // TOOL CARD CLICK → SELECT CONVERSION
    // ======================
    $$('.tool-card').forEach(card => {
        card.addEventListener('click', () => {
            const tool = card.dataset.tool;
            convType.value = tool;
            convType.dispatchEvent(new Event('change'));
            document.getElementById('convert').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // ======================
    // FILE HANDLING
    // ======================
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function getFileIcon(name) {
        const ext = name.split('.').pop().toLowerCase();
        const icons = {
            pdf: '📕', doc: '📘', docx: '📘', ppt: '📙', pptx: '📙',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', webp: '🖼️'
        };
        return icons[ext] || '📄';
    }

    function validateFile(file) {
        if (file.size > MAX_FILE_SIZE) {
            showStatus(`File "${file.name}" exceeds 20MB limit`, 'error');
            return false;
        }
        const tool = convType.value;
        if (!tool) return true; // We'll check later
        const cfg = MIME_MAP[tool];
        if (!cfg) return true;
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!cfg.ext.includes(ext)) {
            showStatus(`Invalid file type. Expected: ${cfg.label} (${cfg.ext.join(', ')})`, 'error');
            return false;
        }
        return true;
    }

    function handleFiles(files) {
        hideStatus();
        const tool = convType.value;
        if (!tool) {
            showStatus('Please select a conversion type first', 'error');
            return;
        }
        const cfg = MIME_MAP[tool];
        const isMulti = cfg && cfg.multi;

        const validFiles = Array.from(files).filter(f => validateFile(f));
        if (validFiles.length === 0) return;

        if (isMulti) {
            selectedFiles.push(...validFiles);
            renderMultiFiles();
            filePreview.style.display = 'none';
            multiList.style.display = 'block';
        } else {
            selectedFiles = [validFiles[0]];
            fileName.textContent = validFiles[0].name;
            fileSize.textContent = formatSize(validFiles[0].size);
            $('.file-icon-preview').textContent = getFileIcon(validFiles[0].name);
            filePreview.style.display = 'block';
            multiList.style.display = 'none';
        }
        updateConvertBtn();
    }

    function renderMultiFiles() {
        multiItems.innerHTML = '';
        selectedFiles.forEach((f, i) => {
            const item = document.createElement('div');
            item.className = 'multi-file-item';
            item.innerHTML = `
                <span style="font-size:1.3rem">${getFileIcon(f.name)}</span>
                <span class="file-name">${f.name}</span>
                <span class="file-size">${formatSize(f.size)}</span>
                <button class="remove-item" data-idx="${i}" aria-label="Remove">✕</button>
            `;
            multiItems.appendChild(item);
        });
        multiItems.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedFiles.splice(+btn.dataset.idx, 1);
                renderMultiFiles();
                if (selectedFiles.length === 0) multiList.style.display = 'none';
                updateConvertBtn();
            });
        });
    }

    function clearFiles() {
        selectedFiles = [];
        filePreview.style.display = 'none';
        multiList.style.display = 'none';
        fileInput.value = '';
        updateConvertBtn();
    }

    function updateConvertBtn() {
        const hasFiles = selectedFiles.length > 0;
        const hasTool = !!convType.value;
        btnConvert.disabled = !hasFiles || !hasTool || isConverting;
        btnConvert.classList.toggle('pulse', hasFiles && hasTool && !isConverting);
    }

    // Drop zone events
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileRemove.addEventListener('click', clearFiles);
    convType.addEventListener('change', () => {
        clearFiles();
        hideStatus();
        updateConvertBtn();
        // Update file input accept attribute
        const tool = convType.value;
        if (tool && MIME_MAP[tool]) {
            fileInput.setAttribute('accept', MIME_MAP[tool].ext.join(','));
            if (MIME_MAP[tool].multi) fileInput.setAttribute('multiple', '');
            else fileInput.removeAttribute('multiple');
        }
    });

    btnAddMore.addEventListener('click', () => fileInput.click());

    // ======================
    // CONVERSION / UPLOAD
    // ======================
    btnConvert.addEventListener('click', startConversion);

    async function startConversion() {
        const tool = convType.value;
        if (!tool || selectedFiles.length === 0 || isConverting) return;

        isConverting = true;
        updateConvertBtn();
        hideStatus();

        // Show progress
        progressCont.style.display = 'flex';
        setProgress(0);
        progressLabel.textContent = 'Uploading...';

        const formData = new FormData();
        if (MIME_MAP[tool]?.multi) {
            selectedFiles.forEach(f => formData.append('files', f));
        } else {
            formData.append('file', selectedFiles[0]);
        }

        try {
            // Simulate upload progress via XHR
            const result = await uploadWithProgress(
                `${API_BASE}/api/convert/${tool}`,
                formData,
                (pct) => {
                    setProgress(Math.round(pct * 0.7)); // 0-70% is upload
                    if (pct >= 100) progressLabel.textContent = 'Converting...';
                }
            );

            setProgress(100);
            progressLabel.textContent = 'Done!';

            if (result.ok) {
                // Download the file
                const blob = result.blob;
                const disposition = result.filename || 'converted_file';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = disposition;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showStatus('Conversion complete! Your file has been downloaded.', 'success');
            } else {
                const errData = result.error;
                showStatus(`❌ ${errData.error || 'Conversion failed. Please try again.'}`, 'error');
            }
        } catch (err) {
            console.error(err);
            showStatus('❌ Network error. Please check your connection and try again.', 'error');
        } finally {
            isConverting = false;
            updateConvertBtn();
            setTimeout(() => {
                progressCont.style.display = 'none';
                setProgress(0);
            }, 2000);
        }
    }

    function uploadWithProgress(url, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
            });

            xhr.responseType = 'blob';

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Extract filename from Content-Disposition header
                    const disposition = xhr.getResponseHeader('Content-Disposition');
                    let filename = 'converted_file';
                    if (disposition) {
                        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                        if (match && match[1]) filename = match[1].replace(/['"]/g, '');
                    }
                    resolve({ ok: true, blob: xhr.response, filename });
                } else {
                    // Try to parse error JSON from blob
                    const reader = new FileReader();
                    reader.onload = () => {
                        try {
                            resolve({ ok: false, error: JSON.parse(reader.result) });
                        } catch {
                            resolve({ ok: false, error: { error: 'Conversion failed' } });
                        }
                    };
                    reader.readAsText(xhr.response);
                }
            };

            xhr.onerror = () => reject(new Error('Network error'));
            xhr.send(formData);
        });
    }

    function setProgress(pct) {
        const circumference = 2 * Math.PI * 54; // r=54
        const offset = circumference - (pct / 100) * circumference;
        progressBar.style.strokeDashoffset = offset;
        progressText.textContent = `${pct}%`;
    }

    // ======================
    // STATUS MESSAGES
    // ======================
    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = `status-message ${type}`;
        statusMsg.style.display = 'block';
    }
    function hideStatus() {
        statusMsg.style.display = 'none';
    }

    // ======================
    // SVG GRADIENT FOR PROGRESS (inject)
    // ======================
    const svgNS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(svgNS, 'defs');
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', 'progressGradient');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '0%');
    const stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#7B2CBF');
    const stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#C77DFF');
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    document.querySelector('.progress-svg')?.prepend(defs);

})();
