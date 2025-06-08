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

    // 更新总分显示
    updateTotalScore(result) {
        const scoreElement = document.getElementById('totalScore');
        const levelElement = document.getElementById('scoreLevel');
        const summaryElement = document.getElementById('scoreSummary');
        const circleElement = document.getElementById('scoreCircle');
        
        const baseScore = result.baseScore;
        const bonus = result.specializationBonus || 0;
        const totalScore = result.totalScore;
        
        // 清理所有可能存在的专精信息显示
        const container = document.querySelector('.score-overview');
        const existingSpecInfos = container.querySelectorAll(
            '.specialization-info, .specialization-info-separate'
        );
        existingSpecInfos.forEach(el => el.remove());
        
        // 完全清空现有内容
        scoreElement.innerHTML = '';
        scoreElement.className = 'score-number';
        
        if (bonus > 0) {
            // 有专精加成时的显示
            scoreElement.innerHTML = `
                <div class="total-score-main">${totalScore}</div>
                <div class="score-breakdown-compact">
                    <span class="base-part">${baseScore}</span>
                    <span class="plus-sign">+</span>
                    <span class="bonus-part">${bonus}</span>
                </div>
            `;
        } else {
            // 无专精加成时的简单显示
            scoreElement.innerHTML = `
                <div class="total-score-main">${totalScore}</div>
            `;
        }
        
        // 设置圆环进度
        const basePercentage = Math.min((baseScore / 100) * 360, 360);
        
        // 清理可能存在的额外元素
        const existingElements = circleElement.querySelectorAll('.bonus-ring, .specialization-info');
        existingElements.forEach(el => el.remove());
        
        if (bonus > 0) {
            // 基础圆环 + 专精效果
            circleElement.style.background = `conic-gradient(
                #48bb78 0deg, 
                #48bb78 ${basePercentage}deg,
                #f0f0f0 ${basePercentage}deg
            )`;
            
            circleElement.style.boxShadow = `
                0 0 20px rgba(102, 126, 234, 0.3),
                0 0 40px rgba(102, 126, 234, 0.1),
                inset 0 0 0 3px rgba(102, 126, 234, 0.2)
            `;
            
            circleElement.classList.add('excellent-plus');
        } else {
            const color = this.getScoreColor(baseScore);
            circleElement.style.background = `conic-gradient(${color} 0deg, ${color} ${basePercentage}deg, #f0f0f0 ${basePercentage}deg)`;
            circleElement.style.boxShadow = 'none';
            circleElement.classList.remove('excellent-plus');
        }
        
        // 设置等级和颜色
        const level = this.getScoreLevel(totalScore);
        levelElement.textContent = level.text;
        levelElement.style.color = level.color;
        
        // 更新总结文字
        summaryElement.innerHTML = level.summary;
        if (bonus > 0) {
            summaryElement.innerHTML += `<br><small style="color: #667eea; font-weight: 500; margin-top: 8px; display: inline-block;">🌟 专精加成让您脱颖而出！</small>`;
        }
        
        // 如果有专精信息，在总分区域下方单独显示（延迟执行，确保只显示一次）
        if (result.specializations && result.specializations.length > 0) {
            setTimeout(() => {
                this.showSpecializationInfo(result.specializations, result.specializationBonus);
            }, 100);
        }
    }

    // 显示专精信息（统一的函数）
    showSpecializationInfo(specializations, totalBonus) {
        const container = document.querySelector('.score-overview');
        
        // 再次确保移除所有可能的专精信息
        const existingSpecInfos = container.querySelectorAll(
            '.specialization-info, .specialization-info-separate'
        );
        existingSpecInfos.forEach(el => el.remove());
        
        const specDiv = document.createElement('div');
        specDiv.className = 'specialization-info-separate';
        
        const specTypes = {
            'programming': '💻 编程开发',
            'data': '📊 数据分析', 
            'design': '🎨 设计创作',
            'engineering': '⚙️ 工程技术',
            'academic': '🎓 学术研究',
            'practical': '💼 实践应用'
        };
        
        let specDetails = specializations.map(spec => 
            `${specTypes[spec.type]} Lv.${spec.level} (+${spec.bonus}分)`
        ).join(' • ');
        
        specDiv.innerHTML = `
            <div class="spec-header-separate">
                <span class="spec-icon">⭐</span>
                <span class="spec-title">专精领域识别</span>
            </div>
            <div class="spec-details-separate">
                ${specDetails}
            </div>
            <div class="spec-total-separate">
                总专精加成: <strong>+${totalBonus}分</strong>
            </div>
        `;
        
        container.appendChild(specDiv);
    }

    // 支持超过100分的等级系统
    getScoreLevel(score) {
        if (score >= 110) {
            return {
                text: '卓越',
                color: '#9f7aea',
                summary: '专精突出，简历质量超群！'
            };
        } else if (score >= 100) {
            return {
                text: '专精',
                color: '#667eea',
                summary: '技能专精，简历质量优异！'
            };
        } else if (score >= 90) {
            return {
                text: '优秀',
                color: '#48bb78',
                summary: '简历质量很高，可以冲击知名企业！'
            };
        } else if (score >= 80) {
            return {
                text: '良好',
                color: '#38a169',
                summary: '简历整体不错，稍作完善就很棒了'
            };
        } else if (score >= 70) {
            return {
                text: '中等',
                color: '#ed8936',
                summary: '简历有一定亮点，还有提升空间'
            };
        } else if (score >= 60) {
            return {
                text: '及格',
                color: '#dd6b20',
                summary: '简历基本完整，建议重点优化'
            };
        } else {
            return {
                text: '待改进',
                color: '#e53e3e',
                summary: '简历需要大幅提升，建议重新梳理'
            };
        }
    }

    // 获取分数颜色
    getScoreColor(score) {
        if (score >= 80) return '#48bb78';
        if (score >= 60) return '#ed8936';
        return '#e53e3e';
    }

    // 更新详细评分
    updateDetailedScores(categoryScores, baseScores, specializationBonus) {
        const container = document.getElementById('scoreCategories');
        const categoryInfo = {
            basicInfo: {
                name: '📋 基本信息',
                subcategories: {
                    name: '姓名信息',
                    phone: '联系电话', 
                    email: '电子邮箱',
                    location: '地址意向'
                }
            },
            education: {
                name: '🎓 教育背景',
                subcategories: {
                    school: '学校层次',
                    academic: '学术表现',
                    major: '专业匹配'
                }
            },
            skills: {
                name: '💻 专业技能',
                subcategories: {
                    programming: '编程开发',
                    design: '设计创作',
                    data: '数据分析', 
                    engineering: '工程技术',
                    business: '商务技能',
                    language: '语言能力'
                }
            },
            experience: {
                name: '💼 实践经验',
                subcategories: {
                    internship: '实习经历',
                    project: '项目经验',
                    quality: '经验质量'
                }
            },
            achievements: {
                name: '🏆 奖励荣誉',
                subcategories: {
                    scholarship: '奖学金',
                    competition: '竞赛获奖',
                    certificate: '证书认证',
                    leadership: '领导经历'
                }
            }
        };
        
        container.innerHTML = '';
        
        Object.entries(categoryScores).forEach(([category, scoreData], index) => {
            const categoryName = categoryInfo[category].name;
            const subcategories = categoryInfo[category].subcategories;
            
            const item = document.createElement('div');
            item.className = 'score-item';
            item.style.animationDelay = `${index * 0.1}s`;
            
            // 获取分数数据
            const baseScore = baseScores[category]?.total || baseScores[category] || 0;
            const categorySpecBonus = scoreData.specializationBonus || 0;
            const displayScore = baseScore + categorySpecBonus;
            const maxScore = this.getMaxScore(category);
            
            // 计算百分比
            const basePercentage = Math.min((baseScore / maxScore) * 100, 100);
            const bonusPercentage = Math.min((categorySpecBonus / maxScore) * 100, 30);
            
            const scoreLevel = this.getScoreGrade(displayScore, maxScore);
            const hasSpecialization = categorySpecBonus > 0;
            
            item.innerHTML = `
                <div class="main-score-row">
                    <div class="category-name">
                        ${categoryName}
                        <span class="score-badge ${scoreLevel.class}" data-tooltip="${scoreLevel.tooltip}">
                            ${scoreLevel.text}
                        </span>
                        ${hasSpecialization ? '<span class="specialization-badge">⭐ 专精</span>' : ''}
                    </div>
                    <div class="score-right-section">
                        <div class="progress-container">
                            <div class="progress-bar-wrapper">
                                <div class="progress-bar">
                                    <div class="progress-fill base-progress" 
                                         style="width: 0%" 
                                         data-target="${basePercentage}">
                                    </div>
                                    ${hasSpecialization ? 
                                        `<div class="progress-fill bonus-progress" 
                                              style="width: 0%; left: ${basePercentage}%" 
                                              data-target="${bonusPercentage}">
                                         </div>` : ''}
                                </div>
                                <div class="progress-legend">
                                    <span class="legend-item base">
                                        <span class="legend-color base"></span>
                                        基础 ${baseScore}
                                    </span>
                                    ${hasSpecialization ? 
                                        `<span class="legend-item bonus">
                                            <span class="legend-color bonus"></span>
                                            专精 +${categorySpecBonus}
                                         </span>` : ''}
                                    <span class="legend-max">/${maxScore}</span>
                                </div>
                            </div>
                        </div>
                        <div class="category-score-container">
                            <div class="main-category-score ${scoreLevel.scoreClass}">
                                ${displayScore}
                            </div>
                            ${hasSpecialization ? 
                                `<div class="score-composition-mini">
                                    ${baseScore}<span class="plus">+</span>${categorySpecBonus}
                                 </div>` : ''}
                        </div>
                        <button class="toggle-detail collapsed" onclick="app.toggleCategoryDetail('${category}')">
                            详情
                        </button>
                    </div>
                </div>
                <div class="category-detail" id="detail-${category}" style="display: none;">
                    <h4>详细评分明细</h4>
                    <div class="subcategory-list">
                        ${this.generateSubcategoryHTML(scoreData, subcategories, baseScores[category])}
                    </div>
                    ${hasSpecialization ? 
                        `<div class="specialization-explanation">
                            <div class="spec-header">
                                <span class="spec-icon">⭐</span>
                                <span class="spec-title">专精加成详情</span>
                            </div>
                            <div class="spec-content">
                                <div class="spec-boost">
                                    <span class="boost-label">专精加成</span>
                                    <span class="boost-value">+${categorySpecBonus} 分</span>
                                </div>
                                <div class="spec-description">
                                    您在该领域表现突出，获得专精加成认可
                                </div>
                            </div>
                         </div>` : ''}
                </div>
            `;
            
            container.appendChild(item);
            
            // 延迟启动进度条动画
            setTimeout(() => {
                const baseFill = item.querySelector('.base-progress');
                if (baseFill) {
                    const targetWidth = baseFill.getAttribute('data-target');
                    baseFill.style.width = targetWidth + '%';
                }
                
                const bonusFill = item.querySelector('.bonus-progress');
                if (bonusFill) {
                    setTimeout(() => {
                        const bonusWidth = bonusFill.getAttribute('data-target');
                        bonusFill.style.width = bonusWidth + '%';
                    }, 600);
                }
            }, 200 + index * 100);
        });
    }

    // 生成子项目HTML
    generateSubcategoryHTML(scoreData, subcategories, baseScoreData) {
        if (!scoreData.details || !baseScoreData?.details) {
            return `
                <div class="empty-subcategory">
                    <span class="empty-icon">📊</span>
                    <span class="empty-text">暂无详细评分数据</span>
                </div>
            `;
        }
        
        let html = '';
        Object.entries(subcategories).forEach(([key, name]) => {
            const score = scoreData.details[key] || 0;
            const maxScore = scoreData.maxScores?.[key] || baseScoreData.maxScores?.[key] || 1;
            const percentage = Math.min((score / maxScore) * 100, 100);
            const subGrade = this.getScoreGrade(score, maxScore);
            
            html += `
                <div class="subcategory-item">
                    <div class="subcategory-info">
                        <span class="subcategory-name">${name}</span>
                        <span class="subcategory-max">满分${maxScore}</span>
                    </div>
                    <div class="subcategory-progress-container">
                        <div class="subcategory-progress">
                            <div class="subcategory-progress-fill" 
                                 style="width: 0%" 
                                 data-target="${percentage}">
                            </div>
                        </div>
                        <span class="subcategory-score ${subGrade.scoreClass}">
                            ${score}
                        </span>
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    // 获取分数等级
    getScoreGrade(score, maxScore) {
        const percentage = (score / maxScore) * 100;
        
        if (percentage >= 85) {
            return {
                class: 'excellent',
                text: '优秀',
                scoreClass: 'score-excellent',
                tooltip: '表现优异，继续保持！'
            };
        } else if (percentage >= 70) {
            return {
                class: 'good',
                text: '良好',
                scoreClass: 'score-good',
                tooltip: '表现不错，还有提升空间'
            };
        } else if (percentage >= 50) {
            return {
                class: 'average',
                text: '一般',
                scoreClass: 'score-average',
                tooltip: '需要重点改进'
            };
        } else {
            return {
                class: 'average',
                text: '待提升',
                scoreClass: 'score-poor',
                tooltip: '建议优先完善此项'
            };
        }
    }

    // 切换详情显示
    toggleCategoryDetail(category) {
        const detailDiv = document.getElementById(`detail-${category}`);
        const button = document.querySelector(`button[onclick="app.toggleCategoryDetail('${category}')"]`);
        
        if (detailDiv.style.display === 'none') {
            detailDiv.style.display = 'block';
            button.classList.remove('collapsed');
            button.classList.add('expanded');
            button.textContent = '收起';
            
            // 启动子项进度条动画
            setTimeout(() => {
                const subProgressBars = detailDiv.querySelectorAll('.subcategory-progress-fill');
                subProgressBars.forEach((bar, index) => {
                    setTimeout(() => {
                        const targetWidth = bar.getAttribute('data-target');
                        bar.style.width = targetWidth + '%';
                    }, index * 100);
                });
            }, 100);
            
        } else {
            detailDiv.style.display = 'none';
            button.classList.remove('expanded');
            button.classList.add('collapsed');
            button.textContent = '详情';
        }
    }

    // 添加进入动画
    animateScoreItems() {
        const scoreItems = document.querySelectorAll('.score-item');
        scoreItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                item.style.transition = 'all 0.5s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 150);
        });
    }

    // 更新岗位推荐
    updateJobRecommendations(jobs) {
        const container = document.getElementById('jobList');
        container.innerHTML = '';
        
        jobs.forEach((job, index) => {
            const item = document.createElement('div');
            item.className = 'job-item';
            item.style.animationDelay = (index * 0.1) + 's';
            
            // 根据匹配度设置不同的边框颜色
            let borderColor = '#667eea';
            if (job.match >= 85) borderColor = '#48bb78';
            else if (job.match >= 70) borderColor = '#ed8936';
            else if (job.match < 60) borderColor = '#f56565';
            
            item.style.borderLeftColor = borderColor;
            
            item.innerHTML = `
                <div class="job-title">${job.category}</div>
                <div class="job-match" style="color: ${borderColor};">匹配度: ${job.match}%</div>
                <div class="job-reason">${job.reason}</div>
            `;
            
            container.appendChild(item);
        });
    }

    // 更新建议
    updateSuggestions(suggestions) {
        const container = document.getElementById('suggestionList');
        container.innerHTML = '';
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = suggestion.includes('质量很好') || suggestion.includes('名校背景') || suggestion.includes('充分利用') ? 
                              'suggestion-item positive' : 'suggestion-item';
            item.style.animationDelay = (index * 0.1) + 's';
            
            // 添加图标
            let icon = '💡';
            if (suggestion.includes('完善') || suggestion.includes('添加')) icon = '📝';
            if (suggestion.includes('技能') || suggestion.includes('证书')) icon = '🔧';
            if (suggestion.includes('实习') || suggestion.includes('项目')) icon = '💼';
            if (suggestion.includes('竞赛') || suggestion.includes('奖学金')) icon = '🏆';
            if (suggestion.includes('质量很好') || suggestion.includes('名校')) icon = '⭐';
            
            item.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <span style="font-size: 1.2em; margin-top: 2px;">${icon}</span>
                    <span>${suggestion}</span>
                </div>
            `;
            
            container.appendChild(item);
        });
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

    // 生成报告内容
    generateReport(analysis) {
        let report = `简历分析报告
==================
生成时间: ${new Date().toLocaleString()}

📊 总体评分
基础分: ${analysis.baseScore}/100分
专精加成: +${analysis.specializationBonus}分
总分: ${analysis.totalScore}分
等级: ${this.getScoreLevel(analysis.totalScore).text}
评语: ${this.getScoreLevel(analysis.totalScore).summary}

`;
        
        // 专精信息
        if (analysis.specializations && analysis.specializations.length > 0) {
            report += `⭐ 专精领域识别
`;
            const specTypes = {
                'programming': '编程开发专精',
                'data': '数据分析专精', 
                'design': '设计创作专精',
                'engineering': '工程技术专精',
                'academic': '学术研究专精',
                'practical': '实践应用专精'
            };
            
            analysis.specializations.forEach(spec => {
                report += `- ${specTypes[spec.type] || spec.type}: 等级${spec.level} (+${spec.bonus}分加成)
`;
            });
            report += '\n';
        }
        
        // 详细评分
        report += `📋 详细评分
`;
        const categoryNames = {
            basicInfo: '基本信息',
            education: '教育背景',
            skills: '专业技能',
            experience: '实践经验',
            achievements: '奖励荣誉'
        };
        
        Object.entries(analysis.categoryScores).forEach(([category, scoreData]) => {
            const score = typeof scoreData === 'object' ? scoreData.total : scoreData;
            const baseScore = analysis.baseScores[category].total || analysis.baseScores[category];
            const maxScore = typeof scoreData === 'object' ? 
                Object.values(scoreData.maxScores || {}).reduce((a, b) => a + b, 0) : 
                this.getMaxScore(category);
            
            const bonusText = score > baseScore ? ` (含${score - baseScore}分专精加成)` : '';
            report += `- ${categoryNames[category]}: ${score}/${maxScore}分${bonusText}
`;
        });
        
        report += `
🎯 岗位推荐
`;
        analysis.jobRecommendations.forEach((job, index) => {
            report += `${index + 1}. ${job.category} (匹配度: ${job.match}%)
   推荐理由: ${job.reason}
`;
        });
        
        report += `
💡 改进建议
`;
        analysis.suggestions.forEach((suggestion, index) => {
            report += `${index + 1}. ${suggestion}
`;
        });
        
        report += `
---
本报告由简历评分工具自动生成
建议结合个人实际情况和目标岗位要求进行参考`;
        
        return report;
    }

    // 获取最大分数
    getMaxScore(category) {
        const maxScores = {
            basicInfo: 10,
            education: 30,
            skills: 25,
            experience: 25,
            achievements: 10
        };
        return maxScores[category] || 10;
    }

    // 清理事件监听器
    destroy() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners.clear();
    }
}

// 初始化应用程序
let app;

function initializeApp() {
    try {
        app = new ResumeScoreApp();
        
        // 检查必要的库是否加载
        if (typeof pdfjsLib !== 'undefined') {
            console.log('PDF.js 库加载成功');
        } else {
            console.warn('PDF.js 库未加载，PDF解析功能可能不可用');
        }
        
        if (typeof mammoth !== 'undefined') {
            console.log('Mammoth 库加载成功');
        } else {
            console.warn('Mammoth 库未加载，Word解析功能可能不可用');
        }
        
        // 初始化多语言
        if (typeof i18n !== 'undefined') {
            i18n.updateUI();
        }
        
        console.log('应用程序初始化完成');
        
    } catch (error) {
        console.error('应用程序初始化失败:', error);
        showError('应用程序初始化失败，请刷新页面重试');
    }
}

// 全局函数（保持向后兼容）
function toggleLanguage() {
    if (typeof i18n !== 'undefined') {
        const newLang = i18n.currentLang === 'zh' ? 'en' : 'zh';
        i18n.switchLanguage(newLang);
        if (app) {
            app.showToast(`Language switched to ${newLang === 'zh' ? 'Chinese' : 'English'}`, 'info');
        }
    }
}

function toggleTheme() {
    if (app) {
        app.toggleTheme();
    }
}

function clearTextarea() {
    if (app) {
        app.clearTextarea();
    }
}

function analyzeResume() {
    if (app) {
        app.analyzeResume();
    }
}

function exportResults() {
    if (app) {
        app.exportResults();
    }
}

function shareResults() {
    if (app) {
        app.shareResults();
    }
}

function analyzeAgain() {
    if (app) {
        app.analyzeAgain();
    }
}

// 全局错误处理
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fed7d7;
        color: #9b2c2c;
        padding: 16px 20px;
        border-radius: 8px;
        border-left: 4px solid #f56565;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 1000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    
    errorDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2em;">❌</span>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="margin-left: auto; background: none; border: none; font-size: 1.2em; cursor: pointer; color: #9b2c2c;">×</button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    // 3秒后自动消失
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 3000);
}

// 全局错误监听
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
    showError('发生了一个错误，请刷新页面重试');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise错误:', event.reason);
    showError('处理请求时发生错误，请重试');
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', function() {
    if (app) {
        app.destroy();
    }
});

// 页面可见性改变时的处理
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 页面隐藏时暂停某些操作
        console.log('页面隐藏');
    } else {
        // 页面重新可见时恢复操作
        console.log('页面可见');
    }
});

// 网络状态监听
window.addEventListener('online', function() {
    if (app) {
        app.showToast('网络连接已恢复', 'success');
    }
});

window.addEventListener('offline', function() {
    if (app) {
        app.showToast('网络连接已断开，某些功能可能不可用', 'warning');
    }
});

// 性能监控
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            const perfData = performance.timing;
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            console.log(`页面加载时间: ${loadTime}ms`);
            
            if (loadTime > 3000) {
                console.warn('页面加载时间较长，可能需要优化');
            }
        }, 0);
    });
}

// 添加CSS动画样式
const style = document.createElement('style');
style.textContent = `
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {
    0%, 100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
}

.loading-content {
    animation: pulse 2s ease-in-out infinite;
}

/* 滚动条样式优化 */
* {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e0 #f7fafc;
}

*::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

*::-webkit-scrollbar-track {
    background: #f7fafc;
    border-radius: 4px;
}

*::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 4px;
    transition: background 0.2s ease;
}

*::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
}

/* 深色主题滚动条 */
.dark-theme *::-webkit-scrollbar-track {
    background: #2d3748;
}

.dark-theme *::-webkit-scrollbar-thumb {
    background: #4a5568;
}

.dark-theme *::-webkit-scrollbar-thumb:hover {
    background: #718096;
}

/* 焦点样式优化 */
*:focus {
    outline: 2px solid #667eea;
    outline-offset: 2px;
}

/* 选择文本样式 */
::selection {
    background: rgba(102, 126, 234, 0.3);
    color: inherit;
}

.dark-theme ::selection {
    background: rgba(102, 126, 234, 0.5);
}
`;

if (!document.querySelector('style[data-script-styles]')) {
    style.setAttribute('data-script-styles', 'true');
    document.head.appendChild(style);
}

// 导出主要类（如果需要模块化使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResumeScoreApp, initializeApp };
}
