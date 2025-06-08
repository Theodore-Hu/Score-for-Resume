// 国际化支持
class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('resume-scorer-lang') || 'zh';
        this.translations = {
            zh: {
                'title': '🎓 应届生简历评分工具',
                'subtitle': '专业评估 • 岗位推荐 • 提升建议',
                'upload-title': '📄 上传简历',
                'upload-hint': '拖拽文件到此处，或点击选择文件',
                'file-types': '支持 PDF、Word 格式，最大 10MB',
                'select-file': '选择文件',
                'or': '或',
                'paste-title': '📝 直接粘贴简历内容',
                'paste-placeholder': '请将简历内容粘贴到这里...',
                'clear': '清空',
                'analyze': '开始分析',
                'evaluating': '评估中...',
                'analyzing': '正在分析您的简历...',
                'export': '📥 导出报告',
                'share': '🔗 分享结果',
                'analyze-again': '🔄 重新分析',
                'detailed-scores': '📊 详细评分',
                'job-recommendations': '🎯 岗位推荐',
                'suggestions': '💡 改进建议',
                'footer': 'Made with ❤️ for 应届毕业生',
                'loading': '正在处理中...'
            },
            en: {
                'title': '🎓 Graduate Resume Scorer',
                'subtitle': 'Professional Assessment • Job Recommendations • Improvement Tips',
                'upload-title': '📄 Upload Resume',
                'upload-hint': 'Drag files here or click to select',
                'file-types': 'Support PDF, Word formats, max 10MB',
                'select-file': 'Select File',
                'or': 'or',
                'paste-title': '📝 Paste Resume Content',
                'paste-placeholder': 'Please paste your resume content here...',
                'clear': 'Clear',
                'analyze': 'Start Analysis',
                'evaluating': 'Evaluating...',
                'analyzing': 'Analyzing your resume...',
                'export': '📥 Export Report',
                'share': '🔗 Share Results',
                'analyze-again': '🔄 Analyze Again',
                'detailed-scores': '📊 Detailed Scores',
                'job-recommendations': '🎯 Job Recommendations',
                'suggestions': '💡 Suggestions',
                'footer': 'Made with ❤️ for Graduates',
                'loading': 'Processing...'
            }
        };
    }

    t(key) {
        return this.translations[this.currentLang]?.[key] || key;
    }

    switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('resume-scorer-lang', lang);
        this.updateUI();
    }

    updateUI() {
        document.querySelectorAll('[data-lang]').forEach(element => {
            const key = element.getAttribute('data-lang');
            element.textContent = this.t(key);
        });

        document.querySelectorAll('[data-lang-placeholder]').forEach(element => {
            const key = element.getAttribute('data-lang-placeholder');
            element.placeholder = this.t(key);
        });

        // 更新语言切换按钮
        document.getElementById('langText').textContent = this.currentLang === 'zh' ? 'EN' : '中';
    }
}

const i18n = new I18n();
