// JSON Import Component
// Handles file upload, validation, and processing of anime/manga data

class JsonImporter {
    constructor() {
        this.supportedFormats = [
            'MAL Export',
            'AniList Export', 
            'Custom Format',
            'Kitsu Export'
        ];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.init();
    }

    init() {
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('json-importer-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'json-importer-styles';
        styles.textContent = `
            .json-import-section {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 15px;
                padding: 30px;
                margin-bottom: 25px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }

            .json-import-header {
                margin-bottom: 25px;
                color: #4facfe;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 1.5rem;
            }

            .json-upload-area {
                border: 2px dashed rgba(79, 172, 254, 0.5);
                border-radius: 12px;
                padding: 40px;
                text-align: center;
                transition: all 0.3s ease;
                margin-bottom: 20px;
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }

            .json-upload-area:hover {
                border-color: #4facfe;
                background: rgba(79, 172, 254, 0.1);
            }

            .json-upload-area.dragover {
                border-color: #00f2fe;
                background: rgba(0, 242, 254, 0.15);
                transform: scale(1.02);
            }

            .json-upload-area.processing {
                pointer-events: none;
                opacity: 0.7;
            }

            .upload-icon {
                font-size: 3rem;
                color: #4facfe;
                margin-bottom: 15px;
                display: block;
            }

            .upload-text {
                color: rgba(255, 255, 255, 0.9);
                font-size: 1.1rem;
                margin-bottom: 10px;
            }

            .upload-subtext {
                color: rgba(255, 255, 255, 0.6);
                font-size: 0.9rem;
            }

            .upload-input {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0;
                cursor: pointer;
            }

            .format-info {
                background: rgba(79, 172, 254, 0.1);
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }

            .format-info h4 {
                color: #4facfe;
                margin-bottom: 10px;
                font-size: 1rem;
            }

            .format-examples {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
                margin-top: 10px;
            }

            .format-example {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                padding: 10px;
                font-size: 0.85rem;
            }

            .format-example strong {
                color: #4facfe;
                display: block;
                margin-bottom: 5px;
            }

            .json-preview {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
                padding: 15px;
                margin-top: 15px;
                font-family: 'Courier New', monospace;
                font-size: 0.8rem;
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid rgba(79, 172, 254, 0.3);
            }

            .file-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: rgba(79, 172, 254, 0.1);
                padding: 10px 15px;
                border-radius: 8px;
                margin-bottom: 15px;
            }

            .file-details {
                color: rgba(255, 255, 255, 0.9);
            }

            .file-name {
                font-weight: 600;
                margin-bottom: 2px;
            }

            .file-size {
                font-size: 0.8rem;
                color: rgba(255, 255, 255, 0.6);
            }

            .file-actions {
                display: flex;
                gap: 10px;
            }

            .validation-results {
                margin-top: 15px;
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid;
            }

            .validation-results.success {
                background: rgba(74, 222, 128, 0.1);
                border-left-color: #4ade80;
            }

            .validation-results.error {
                background: rgba(248, 113, 113, 0.1);
                border-left-color: #f87171;
            }

            .validation-results.warning {
                background: rgba(251, 191, 36, 0.1);
                border-left-color: #fbbf24;
            }

            .validation-title {
                font-weight: 600;
                margin-bottom: 8px;
            }

            .validation-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .validation-list li {
                padding: 3px 0;
                font-size: 0.9rem;
            }

            .sample-json {
                margin-top: 20px;
            }

            .sample-toggle {
                background: rgba(79, 172, 254, 0.2);
                border: 1px solid rgba(79, 172, 254, 0.5);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.2s ease;
            }

            .sample-toggle:hover {
                background: rgba(79, 172, 254, 0.3);
            }

            .sample-content {
                display: none;
                margin-top: 15px;
            }

            .sample-content.visible {
                display: block;
            }

            .btn.btn-primary {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .btn.btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(79, 172, 254, 0.3);
            }

            .btn.btn-primary:disabled {
                background: rgba(255, 255, 255, 0.2);
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .processing-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                color: white;
                font-size: 1rem;
            }

            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top: 2px solid #4facfe;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 10px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;

        document.head.appendChild(styles);
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('JSON importer container not found');
            return;
        }

        container.innerHTML = `
            <div class="json-import-section">
                <h2 class="json-import-header">
                    📁 Import from JSON File
                </h2>
                
                <div class="format-info">
                    <h4>Supported Formats</h4>
                    <p>Upload your anime/manga list in JSON format. Supports exports from MAL, AniList, Kitsu, or custom formats.</p>
                    <div class="format-examples">
                        <div class="format-example">
                            <strong>Required Fields:</strong>
                            title, status (optional: score, progress, dates)
                        </div>
                        <div class="format-example">
                            <strong>Max File Size:</strong>
                            ${this.maxFileSize / (1024 * 1024)}MB
                        </div>
                        <div class="format-example">
                            <strong>Formats:</strong>
                            .json, .txt (JSON content)
                        </div>
                    </div>
                </div>

                <div class="json-upload-area" id="json-upload-area">
                    <input type="file" id="json-file-input" class="upload-input" accept=".json,.txt" />
                    <div class="upload-icon">📄</div>
                    <div class="upload-text">Drag & drop your JSON file here</div>
                    <div class="upload-subtext">or click to browse and select a file</div>
                </div>

                <div id="file-info" class="file-info" style="display: none;">
                    <div class="file-details">
                        <div class="file-name" id="file-name"></div>
                        <div class="file-size" id="file-size"></div>
                    </div>
                    <div class="file-actions">
                        <button type="button" class="btn btn-primary" id="process-json" disabled>
                            Process File
                        </button>
                        <button type="button" class="btn btn-secondary" id="clear-json">
                            Clear
                        </button>
                    </div>
                </div>

                <div id="validation-results" style="display: none;"></div>
                <div id="json-preview" style="display: none;"></div>

                <div class="sample-json">
                    <button type="button" class="sample-toggle" id="sample-toggle">
                        📖 Show Sample JSON Format
                    </button>
                    <div class="sample-content" id="sample-content">
                        <div class="json-preview">
[
  {
    "title": "Attack on Titan",
    "status": "completed",
    "score": 9,
    "progress": 25,
    "total_episodes": 25,
    "start_date": "2023-01-01",
    "finish_date": "2023-02-15",
    "notes": "Amazing series!"
  },
  {
    "title": "Your Name",
    "status": "plan_to_watch",
    "score": 0,
    "progress": 0,
    "total_episodes": 1
  }
]
                        </div>
                        <p style="margin-top: 10px; font-size: 0.9rem; color: rgba(255, 255, 255, 0.7);">
                            <strong>Note:</strong> The format is flexible - you can use different field names like 
                            'name' instead of 'title', 'my_score' instead of 'score', etc.
                        </p>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents(container);
    }

    bindEvents(container) {
        const uploadArea = container.querySelector('#json-upload-area');
        const fileInput = container.querySelector('#json-file-input');
        const fileInfo = container.querySelector('#file-info');
        const processBtn = container.querySelector('#process-json');
        const clearBtn = container.querySelector('#clear-json');
        const sampleToggle = container.querySelector('#sample-toggle');
        const sampleContent = container.querySelector('#sample-content');

        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0], container);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0], container);
            }
        });

        // Process button
        processBtn.addEventListener('click', () => {
            this.processFile(container);
        });

        // Clear button
        clearBtn.addEventListener('click', () => {
            this.clearFile(container);
        });

        // Sample toggle
        sampleToggle.addEventListener('click', () => {
            sampleContent.classList.toggle('visible');
            const isVisible = sampleContent.classList.contains('visible');
            sampleToggle.textContent = isVisible ? '📖 Hide Sample JSON Format' : '📖 Show Sample JSON Format';
        });
    }

    handleFile(file, container) {
        // Validate file
        const validation = this.validateFile(file);
        
        if (!validation.valid) {
            this.showValidationResults(container, 'error', 'File Validation Failed', validation.errors);
            return;
        }

        // Show file info
        this.showFileInfo(container, file);

        // Read and preview file
        this.readFile(file, container);
    }

    validateFile(file) {
        const errors = [];
        const warnings = [];

        // Check file size
        if (file.size > this.maxFileSize) {
            errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.maxFileSize)})`);
        }

        // Check file type
        const allowedTypes = ['.json', '.txt'];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedTypes.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExtension) {
            errors.push(`File type not supported. Please use: ${allowedTypes.join(', ')}`);
        }

        // Check file name for common formats
        if (fileName.includes('mal') || fileName.includes('myanimelist')) {
            warnings.push('Detected MAL export format');
        } else if (fileName.includes('anilist')) {
            warnings.push('Detected AniList export format');
        } else if (fileName.includes('kitsu')) {
            warnings.push('Detected Kitsu export format');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    readFile(file, container) {
        const uploadArea = container.querySelector('#json-upload-area');
        const processBtn = container.querySelector('#process-json');
        
        // Show processing state
        uploadArea.classList.add('processing');
        uploadArea.innerHTML += '<div class="processing-overlay"><div class="spinner"></div>Reading file...</div>';
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                this.currentFileContent = content;
                
                // Try to parse JSON to validate
                const jsonData = JSON.parse(content);
                const validation = this.validateJsonContent(jsonData);
                
                // Show validation results
                this.showValidationResults(container, 
                    validation.valid ? 'success' : 'warning', 
                    validation.valid ? 'File Valid' : 'File Parsed with Warnings',
                    validation.valid ? validation.info : validation.warnings
                );

                // Show preview
                this.showJsonPreview(container, content);
                
                // Enable process button
                processBtn.disabled = false;
                
            } catch (error) {
                this.showValidationResults(container, 'error', 'JSON Parse Error', [
                    `Invalid JSON format: ${error.message}`,
                    'Please check your file format and try again.'
                ]);
                processBtn.disabled = true;
            } finally {
                // Remove processing state
                uploadArea.classList.remove('processing');
                const overlay = uploadArea.querySelector('.processing-overlay');
                if (overlay) overlay.remove();
            }
        };

        reader.onerror = () => {
            this.showValidationResults(container, 'error', 'File Read Error', [
                'Failed to read the file. Please try again.'
            ]);
            uploadArea.classList.remove('processing');
            const overlay = uploadArea.querySelector('.processing-overlay');
            if (overlay) overlay.remove();
        };

        reader.readAsText(file);
    }

    validateJsonContent(jsonData) {
        const info = [];
        const warnings = [];
        let validItems = 0;
        let totalItems = 0;

        if (!Array.isArray(jsonData)) {
            return {
                valid: false,
                warnings: ['JSON must be an array of items']
            };
        }

        totalItems = jsonData.length;
        info.push(`Found ${totalItems} items in the file`);

        // Check each item
        jsonData.forEach((item, index) => {
            if (this.hasRequiredFields(item)) {
                validItems++;
            } else {
                warnings.push(`Item ${index + 1}: Missing required fields (title)`);
            }
        });

        info.push(`${validItems} items have valid format`);
        
        if (validItems < totalItems) {
            warnings.push(`${totalItems - validItems} items may have issues`);
        }

        // Detect common field names
        const sampleItem = jsonData[0] || {};
        const fieldInfo = this.detectFieldMappings(sampleItem);
        if (fieldInfo.length > 0) {
            info.push('Detected fields: ' + fieldInfo.join(', '));
        }

        return {
            valid: validItems > 0,
            info,
            warnings,
            stats: { total: totalItems, valid: validItems }
        };
    }

    hasRequiredFields(item) {
        const titleFields = ['title', 'name', 'series_title', 'anime_title', 'manga_title'];
        return titleFields.some(field => item[field] && item[field].trim());
    }

    detectFieldMappings(item) {
        const detectedFields = [];
        
        // Title fields
        if (item.title) detectedFields.push('title');
        else if (item.name) detectedFields.push('name');
        else if (item.series_title) detectedFields.push('series_title');

        // Status fields
        if (item.status || item.my_status) detectedFields.push('status');

        // Score fields
        if (item.score || item.my_score || item.rating) detectedFields.push('score');

        // Progress fields
        if (item.progress || item.watched_episodes || item.read_chapters) detectedFields.push('progress');

        return detectedFields;
    }

    showFileInfo(container, file) {
        const fileInfo = container.querySelector('#file-info');
        const fileName = container.querySelector('#file-name');
        const fileSize = container.querySelector('#file-size');

        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.style.display = 'flex';
    }

    showValidationResults(container, type, title, messages) {
        const resultsDiv = container.querySelector('#validation-results');
        resultsDiv.className = `validation-results ${type}`;
        resultsDiv.style.display = 'block';

        const messagesList = messages.map(msg => `<li>${msg}</li>`).join('');
        resultsDiv.innerHTML = `
            <div class="validation-title">${title}</div>
            <ul class="validation-list">${messagesList}</ul>
        `;
    }

    showJsonPreview(container, content) {
        const previewDiv = container.querySelector('#json-preview');
        if (!previewDiv) return;

        // Create preview element if it doesn't exist
        let jsonPreview = container.querySelector('.json-preview');
        if (!jsonPreview) {
            jsonPreview = document.createElement('div');
            jsonPreview.className = 'json-preview';
            previewDiv.appendChild(jsonPreview);
        }

        // Show truncated preview
        const lines = content.split('\n');
        const maxLines = 20;
        const preview = lines.length > maxLines 
            ? lines.slice(0, maxLines).join('\n') + '\n... (truncated)'
            : content;

        jsonPreview.textContent = preview;
        previewDiv.style.display = 'block';
    }

    processFile(container) {
        if (!this.currentFileContent) {
            console.error('No file content to process');
            return;
        }

        try {
            const jsonData = JSON.parse(this.currentFileContent);
            
            // Emit event for main app to handle
            const event = new CustomEvent('jsonImported', {
                detail: {
                    data: jsonData,
                    filename: container.querySelector('#file-name').textContent
                }
            });
            
            document.dispatchEvent(event);
            
        } catch (error) {
            this.showValidationResults(container, 'error', 'Processing Error', [
                `Failed to process JSON: ${error.message}`
            ]);
        }
    }

    clearFile(container) {
        const fileInfo = container.querySelector('#file-info');
        const validationResults = container.querySelector('#validation-results');
        const jsonPreview = container.querySelector('#json-preview');
        const fileInput = container.querySelector('#json-file-input');
        const processBtn = container.querySelector('#process-json');

        fileInfo.style.display = 'none';
        validationResults.style.display = 'none';
        jsonPreview.style.display = 'none';
        fileInput.value = '';
        processBtn.disabled = true;
        this.currentFileContent = null;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export the component
window.JsonImporter = JsonImporter;