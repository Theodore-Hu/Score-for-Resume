// 应用程序主类
class ResumeScoreApp {
    constructor() {
        this.currentAnalysis = null;
        this.isDarkTheme = localStorage.getItem('theme') === 'dark';
        this.isProcessing = false;
        this.eventListeners = new Map();
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.updateCharacterCount();
    }

    setupTheme() {
        if (this.isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.querySelector('.theme-icon').textContent = '☀️';
        }
    }

    setupEventListeners() {
        // 防抖处理的文件上传
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const textarea = document.getElementById('resumeText');

        // 拖拽上传事件
        const dragEvents = {
            dragover: (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            },
            dragleave: (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            },
            drop: (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            }
        };

        Object.entries(dragEvents).forEach(([event, handler]) => {
            uploadArea.addEventListener(event, handler);
            this.eventListeners.set(`uploadArea-${event}`, { element: uploadArea, event, handler });
        });

        // 文件选择事件
        const fileChangeHandler = (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        };
        fileInput.addEventListener('change', fileChangeHandler);
        this.eventListeners.set('fileInput-change', { element: fileInput, event: 'change', handler: fileChangeHandler });

        // 文本输入事件（防抖）
        const textInputHandler = this.debounce(() => {
            this.checkTextInput();
            this.updateCharacterCount();
        }, 300);
        
        textarea.addEventListener('input', textInputHandler);
        this.eventListeners.set('textarea-input', { element: textarea, event: 'input', handler: textInputHandler });

        // 粘贴事件处理
        const pasteHandler = (e) => {
            setTimeout(() => {
                this.checkTextInput();
                this.updateCharacterCount();
            }, 0);
        };
        textarea.addEventListener('paste', pasteHandler);
        this.eventListeners.set('textarea-paste', { element: textarea, event: 'paste', handler: pasteHandler });
    }

    setupKeyboardShortcuts() {
        const keydownHandler = (e) => {
            // Ctrl/Cmd + U: 上传文件
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                document.getElementById('fileInput').click();
            }
            
            // Ctrl/Cmd + Enter: 开始分析
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!document.querySelector('.analyze-btn').disabled) {
                    this.analyzeResume();
                }
            }
            
            // Ctrl/Cmd + E: 导出报告
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                if (this.currentAnalysis) {
                    this.exportResults();
                }
            }
            
            // F1: 显示/隐藏快捷键帮助
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggleKeyboardShortcuts();
            }
            
            // Esc: 关闭弹窗
            if (e.key === 'Escape') {
                this.closeModals();
            }
        };

        document.addEventListener('keydown', keydownHandler);
        this.eventListeners.set('document-keydown', { element: document, event: 'keydown', handler: keydownHandler });
    }

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    updateCharacterCount() {
        const textarea = document.getElementById('resumeText');
        const charCount = document.getElementById('charCount');
        const count = textarea.value.length;
        
        charCount.textContent = `${count} 字符`;
        
        if (count > 2000) {
            charCount.style.color = '#48bb78';
        } else if (count > 500) {
            charCount.style.color = '#ed8936';
        } else {
            charCount.style.color = '#666';
        }
    }

    checkTextInput() {
        const text = document.getElementById('resumeText').value.trim();
        const analyzeBtn = document.querySelector('.analyze-btn');
        
        if (text.length > 100) {
            analyzeBtn.style.background = '#48bb78';
            analyzeBtn.disabled = false;
        } else {
            analyzeBtn.style.background = '#ccc';
            analyzeBtn.disabled = true;
        }
    }

    async handleFileUpload(file) {
        if (this.isProcessing) {
            this.showToast('正在处理文件，请稍候...', 'info');
            return;
        }

        // 文件验证
        const validation = this.validateFile(file);
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            return;
        }

        this.isProcessing = true;
        this.showLoading('正在解析文件...');

        try {
            const text = await ResumeParser.parseFile(file);
            
            if (text.trim().length < 50) {
                throw new Error('文件内容过少，请检查文件是否正确');
            }

            document.getElementById('resumeText').value = text;
            this.updateCharacterCount();
            this.checkTextInput();
            
            this.hideLoading();
            this.showToast('文件解析成功！', 'success');
            
            // 自动开始分析
            setTimeout(() => {
                this.analyzeResume();
            }, 500);

        } catch (error) {
            this.hideLoading();
            this.showToast('文件解析失败: ' + error.message, 'error');
            console.error('File parsing error:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    validateFile(file) {
        // 文件大小检查
        if (file.size > 10 * 1024 * 1024) {
            return { valid: false, message: '文件大小超过10MB限制' };
        }

        // 文件类型检查
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        const fileName = file.name.toLowerCase();
        const isValidType = allowedTypes.includes(file.type) || 
                           fileName.endsWith('.pdf') || 
                           fileName.endsWith('.doc') || 
                           fileName.endsWith('.docx');

        if (!isValidType) {
            return { valid: false, message: '请上传PDF或Word格式的文件' };
        }

        return { valid: true };
    }

    async analyzeResume() {
        if (this.isProcessing) {
            this.showToast('正在处理中，请稍候...', 'info');
            return;
        }

        const text = document.getElementById('resumeText').value.trim();

        if (text.length < 50) {
            this.showToast('简历内容过少，请输入完整的简历信息', 'warning');
            return;
        }

        this.isProcessing = true;
        this.showLoading('正在分析简历...');

        try {
            // 模拟分析延迟
            await new Promise(resolve => setTimeout(resolve, 1500));

            const scorer = new ResumeScorer();
            const result = scorer.scoreResume(text);

            this.hideLoading();
            this.displayResults(result);
            this.showToast('简历分析完成！', 'success');

        } catch (error) {
            this.hideLoading();
            this.showToast('分析失败: ' + error.message, 'error');
            console.error('Analysis error:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    displayResults(result) {
        this.currentAnalysis = result;
        
        const resultSection = document.getElementById('resultSection');
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
        
        // 更新各个部分
        this.updateTotalScore(result);
        this.updateDetailedScores(result.categoryScores, result.baseScores, result.specializationBonus);
        this.updateJobRecommendations(result.jobRecommendations);
        this.updateSuggestions(result.suggestions);
        
        // 启动动画
        setTimeout(() => {
            this.animateScoreItems();
        }, 500);
    }

    // Toast 通知系统
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const typeIcons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${typeIcons[type]}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(toast);

        // 自动移除
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);

        // 限制最大数量
        const toasts = container.querySelectorAll('.toast');
        if (toasts.length > 3) {
            toasts[0].remove();
        }
    }

    // 加载状态管理
    showLoading(message) {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        text.textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
    }

    // 导出功能
    exportResults() {
        if (!this.currentAnalysis) {
            this.showToast('没有可导出的分析结果', 'warning');
            return;
        }

        try {
            const reportContent = this.generateReport(this.currentAnalysis);
            this.downloadFile(reportContent, `简历分析报告_${new Date().toISOString().slice(0, 10)}.txt`);
            this.showToast('报告导出成功！', 'success');
        } catch (error) {
            this.showToast('导出失败: ' + error.message, 'error');
        }
    }

    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // 分享功能
    async shareResults() {
        if (!this.currentAnalysis) {
            this.showToast('没有可分享的结果', 'warning');
            return;
        }

        const shareData = {
            title: '我的简历评分结果',
            text: `我的简历获得了 ${this.currentAnalysis.totalScore} 分！`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                this.showToast('分享成功！', 'success');
            } else {
                // 降级到复制链接
                await navigator.clipboard.writeText(window.location.href);
                this.showToast('链接已复制到剪贴板！', 'success');
            }
        } catch (error) {
            this.showToast('分享失败', 'error');
        }
    }

    // 清空功能
    clearTextarea() {
        document.getElementById('resumeText').value = '';
        this.updateCharacterCount();
        this.checkTextInput();
        this.showToast('内容已清空', 'info');
    }

    // 重新分析
    analyzeAgain() {
        const resultSection = document.getElementById('resultSection');
        resultSection.style.display = 'none';
        this.currentAnalysis = null;
        document.getElementById('resumeText').focus();
        this.showToast('可以重新上传或粘贴简历内容', 'info');
    }

    // 主题切换
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
        
        const icon = document.querySelector('.theme-icon');
        icon.textContent = this.isDarkTheme ? '☀️' : '🌙';
        
        this.showToast(`已切换到${this.isDarkTheme ? '深色' : '浅色'}模式`, 'info');
    }

    // 快捷键帮助
    toggleKeyboardShortcuts() {
        const shortcuts = document.getElementById('keyboardShortcuts');
        shortcuts.style.display = shortcuts.style.display === 'none' ? 'block' : 'none';
    }

    closeModals() {
        document.getElementById('keyboardShortcuts').style.display = 'none';
    }

    // 生成报告内容（保持原有逻辑）
    generateReport(analysis) {
        // ... 原有的 generateReport 方法内容
        return `简历分析报告\n==================\n生成时间: ${new Date().toLocaleString()}\n总分: ${analysis.totalScore}分`;
    }

    // 清理事件监听器
    destroy() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners.clear();
    }

    // 其他原有方法保持不变...
    updateTotalScore(result) {
        // 保持原有逻辑
    }

    updateDetailedScores(categoryScores, baseScores, specializationBonus) {
        // 保持原有逻辑
    }

    updateJobRecommendations(jobs) {
        // 保持原有逻辑
    }

    updateSuggestions(suggestions) {
        // 保持原有逻辑
    }

    animateScoreItems() {
        // 保持原有逻辑
    }
}

// 全局函数
function toggleLanguage() {
    const newLang = i18n.currentLang === 'zh' ? 'en' : 'zh';
    i18n.switchLanguage(newLang);
    app.showToast(`Language switched to ${newLang === 'zh' ? 'Chinese' : 'English'}`, 'info');
}

function toggleTheme() {
    app.toggleTheme();
}

function clearTextarea() {
    app.clearTextarea();
}

function analyzeResume() {
    app.analyzeResume();
}

function exportResults() {
    app.exportResults();
}

function shareResults() {
    app.shareResults();
}

function analyzeAgain() {
    app.analyzeAgain();
}

//
