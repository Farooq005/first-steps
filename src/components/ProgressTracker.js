// Progress Tracker Component
// Handles real-time progress updates with visual feedback

class ProgressTracker {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isVisible = false;
        this.currentProgress = 0;
        this.progressHistory = [];
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Progress tracker container not found');
            return;
        }

        this.container.innerHTML = `
            <div id="progress-modal" class="progress-modal hidden">
                <div class="progress-content">
                    <div class="progress-header">
                        <h3 id="progress-title">Processing...</h3>
                        <button id="progress-cancel" class="btn btn-secondary">Cancel</button>
                    </div>
                    
                    <div class="progress-main">
                        <div class="progress-bar-container">
                            <div class="progress-bar">
                                <div id="progress-fill" class="progress-fill"></div>
                            </div>
                            <div class="progress-text">
                                <span id="progress-percentage">0%</span>
                                <span id="progress-counter"></span>
                            </div>
                        </div>
                        
                        <div id="progress-message" class="progress-message">Ready to start...</div>
                        
                        <div class="progress-details">
                            <div class="progress-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Success:</span>
                                    <span id="progress-success" class="stat-value success">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Failed:</span>
                                    <span id="progress-failed" class="stat-value error">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Total:</span>
                                    <span id="progress-total" class="stat-value">0</span>
                                </div>
                            </div>
                        </div>
                        
                        <div id="progress-log" class="progress-log">
                            <div class="log-header">
                                <span>Activity Log</span>
                                <button id="clear-log" class="btn btn-small">Clear</button>
                            </div>
                            <div id="log-content" class="log-content"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('progress-tracker-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'progress-tracker-styles';
        styles.textContent = `
            .progress-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }

            .progress-modal.hidden {
                opacity: 0;
                visibility: hidden;
            }

            .progress-content {
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                border: 1px solid rgba(79, 172, 254, 0.3);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                color: white;
            }

            .progress-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 25px;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(79, 172, 254, 0.3);
            }

            .progress-header h3 {
                margin: 0;
                color: #4facfe;
                font-size: 1.5rem;
            }

            .progress-bar-container {
                margin-bottom: 20px;
            }

            .progress-bar {
                width: 100%;
                height: 12px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: 10px;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
                border-radius: 6px;
                transition: width 0.3s ease;
                width: 0%;
                position: relative;
                overflow: hidden;
            }

            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(45deg, 
                    transparent 30%, 
                    rgba(255, 255, 255, 0.3) 50%, 
                    transparent 70%);
                animation: progress-shine 2s infinite;
            }

            @keyframes progress-shine {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }

            .progress-text {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.9rem;
                color: rgba(255, 255, 255, 0.8);
            }

            .progress-message {
                background: rgba(255, 255, 255, 0.05);
                padding: 15px;
                border-radius: 10px;
                margin-bottom: 20px;
                font-size: 0.95rem;
                border-left: 4px solid #4facfe;
                min-height: 20px;
                display: flex;
                align-items: center;
            }

            .progress-details {
                margin-bottom: 20px;
            }

            .progress-stats {
                display: flex;
                gap: 20px;
                justify-content: space-around;
                background: rgba(255, 255, 255, 0.05);
                padding: 15px;
                border-radius: 10px;
            }

            .stat-item {
                text-align: center;
                flex: 1;
            }

            .stat-label {
                display: block;
                font-size: 0.8rem;
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 5px;
            }

            .stat-value {
                display: block;
                font-size: 1.2rem;
                font-weight: bold;
            }

            .stat-value.success {
                color: #4ade80;
            }

            .stat-value.error {
                color: #f87171;
            }

            .progress-log {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 10px;
                overflow: hidden;
                max-height: 200px;
            }

            .log-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 15px;
                background: rgba(79, 172, 254, 0.2);
                font-size: 0.9rem;
                font-weight: 600;
            }

            .log-content {
                padding: 10px 15px;
                max-height: 150px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 0.8rem;
                line-height: 1.4;
            }

            .log-entry {
                margin-bottom: 8px;
                padding: 5px 8px;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.05);
                border-left: 3px solid transparent;
            }

            .log-entry.status {
                border-left-color: #4facfe;
            }

            .log-entry.success {
                border-left-color: #4ade80;
                background: rgba(74, 222, 128, 0.1);
            }

            .log-entry.error {
                border-left-color: #f87171;
                background: rgba(248, 113, 113, 0.1);
            }

            .log-entry.warning {
                border-left-color: #fbbf24;
                background: rgba(251, 191, 36, 0.1);
            }

            .log-timestamp {
                color: rgba(255, 255, 255, 0.5);
                font-size: 0.7rem;
                margin-right: 8px;
            }

            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.2s ease;
                font-weight: 500;
            }

            .btn.btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .btn.btn-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .btn.btn-small {
                padding: 4px 8px;
                font-size: 0.75rem;
            }

            .progress-content::-webkit-scrollbar,
            .log-content::-webkit-scrollbar {
                width: 6px;
            }

            .progress-content::-webkit-scrollbar-track,
            .log-content::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
            }

            .progress-content::-webkit-scrollbar-thumb,
            .log-content::-webkit-scrollbar-thumb {
                background: rgba(79, 172, 254, 0.5);
                border-radius: 3px;
            }

            .progress-content::-webkit-scrollbar-thumb:hover,
            .log-content::-webkit-scrollbar-thumb:hover {
                background: rgba(79, 172, 254, 0.7);
            }
        `;

        document.head.appendChild(styles);
    }

    bindEvents() {
        // Cancel button
        const cancelBtn = this.container.querySelector('#progress-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.onCancel && this.onCancel();
            });
        }

        // Clear log button
        const clearLogBtn = this.container.querySelector('#clear-log');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => {
                this.clearLog();
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.onCancel && this.onCancel();
            }
        });
    }

    show(title = 'Processing...') {
        const modal = this.container.querySelector('#progress-modal');
        const titleEl = this.container.querySelector('#progress-title');
        
        if (titleEl) titleEl.textContent = title;
        if (modal) modal.classList.remove('hidden');
        
        this.isVisible = true;
        this.reset();
    }

    hide() {
        const modal = this.container.querySelector('#progress-modal');
        if (modal) modal.classList.add('hidden');
        this.isVisible = false;
    }

    reset() {
        this.currentProgress = 0;
        this.progressHistory = [];
        this.updateProgress(0);
        this.updateMessage('Ready to start...');
        this.updateStats(0, 0, 0);
        this.clearLog();
    }

    updateProgress(percentage) {
        this.currentProgress = percentage;
        const fillEl = this.container.querySelector('#progress-fill');
        const percentageEl = this.container.querySelector('#progress-percentage');
        
        if (fillEl) {
            fillEl.style.width = `${percentage}%`;
        }
        
        if (percentageEl) {
            percentageEl.textContent = `${Math.round(percentage)}%`;
        }
    }

    updateMessage(message) {
        const messageEl = this.container.querySelector('#progress-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    updateCounter(current, total) {
        const counterEl = this.container.querySelector('#progress-counter');
        if (counterEl && total > 0) {
            counterEl.textContent = `${current} / ${total}`;
        } else if (counterEl) {
            counterEl.textContent = '';
        }
    }

    updateStats(success, failed, total) {
        const successEl = this.container.querySelector('#progress-success');
        const failedEl = this.container.querySelector('#progress-failed');
        const totalEl = this.container.querySelector('#progress-total');
        
        if (successEl) successEl.textContent = success;
        if (failedEl) failedEl.textContent = failed;
        if (totalEl) totalEl.textContent = total;
    }

    addLogEntry(message, type = 'status') {
        const logContent = this.container.querySelector('#log-content');
        if (!logContent) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            ${message}
        `;

        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;

        // Limit log entries to prevent memory issues
        const entries = logContent.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }

    clearLog() {
        const logContent = this.container.querySelector('#log-content');
        if (logContent) {
            logContent.innerHTML = '';
        }
    }

    handleProgressUpdate(data) {
        const { type, message, progress, current, total } = data;

        // Update progress bar
        if (typeof progress === 'number') {
            this.updateProgress(progress);
        }

        // Update message
        if (message) {
            this.updateMessage(message);
            this.addLogEntry(message, type || 'status');
        }

        // Update counter
        if (current !== undefined && total !== undefined) {
            this.updateCounter(current, total);
        }

        // Store progress history
        this.progressHistory.push({
            timestamp: Date.now(),
            ...data
        });
    }

    setOnCancel(callback) {
        this.onCancel = callback;
    }

    getProgressHistory() {
        return this.progressHistory;
    }

    exportLog() {
        const logs = this.progressHistory.map(entry => 
            `${new Date(entry.timestamp).toISOString()} [${entry.type?.toUpperCase() || 'INFO'}] ${entry.message}`
        ).join('\n');

        const blob = new Blob([logs], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sync-log-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Export the component
window.ProgressTracker = ProgressTracker;