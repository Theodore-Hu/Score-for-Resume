// 简历解析器 - 优化版
class ResumeParser {
    static async parsePDF(file) {
        try {
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js库未加载，请刷新页面重试');
            }
            
            // 添加进度回调
            const progressCallback = (progress) => {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                console.log(`PDF解析进度: ${percent}%`);
            };
            
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({
                data: arrayBuffer,
                verbosity: 0, // 减少控制台输出
                maxImageSize: 1024 * 1024, // 限制图片大小以节省内存
                disableFontFace: true, // 禁用字体渲染以提高性能
                useSystemFonts: false
            });
            
            const pdf = await loadingTask.promise;
            let fullText = '';
            const maxPages = Math.min(pdf.numPages, 10); // 限制最大页数
            
            // 并行处理页面（但限制并发数量）
            const concurrentLimit = 3;
            const chunks = [];
            
            for (let i = 0; i < maxPages; i += concurrentLimit) {
                const pagePromises = [];
                for (let j = i; j < Math.min(i + concurrentLimit, maxPages); j++) {
                    pagePromises.push(this.extractPageText(pdf, j + 1));
                }
                const chunkResults = await Promise.all(pagePromises);
                chunks.push(...chunkResults);
            }
            
            fullText = chunks.join('\n');
            
            // 清理内存
            await pdf.destroy();
            
            return this.cleanText(fullText);
        } catch (error) {
            console.error('PDF解析错误:', error);
            throw new Error('PDF解析失败: ' + error.message);
        }
    }
    
    static async extractPageText(pdf, pageNum) {
        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // 改进文本提取，保持格式
            const textItems = textContent.items.map(item => {
                // 处理特殊字符和换行
                let text = item.str;
                if (item.hasEOL) {
                    text += '\n';
                }
                return text;
            });
            
            const pageText = textItems.join(' ');
            
            // 清理页面内存
            page.cleanup();
            
            return pageText;
        } catch (error) {
            console.warn(`页面 ${pageNum} 解析失败:`, error);
            return '';
        }
    }
    
    static async parseWord(file) {
        try {
            if (typeof mammoth === 'undefined') {
                throw new Error('Word解析库未加载，请刷新页面重试');
            }
            
            const arrayBuffer = await file.arrayBuffer();
            
            // 使用更好的提取选项
            const result = await mammoth.extractRawText({ 
                arrayBuffer,
                includeEmbeddedStyleMap: false,
                includeDefaultStyleMap: false
            });
            
            if (result.messages && result.messages.length > 0) {
                console.warn('Word解析警告:', result.messages);
            }
            
            return this.cleanText(result.value);
        } catch (error) {
            console.error('Word解析错误:', error);
            throw new Error('Word文档解析失败: ' + error.message);
        }
    }
    
    // 文本清理和标准化
    static cleanText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        
        return text
            // 统一换行符
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            // 移除多余空白
            .replace(/\t/g, ' ')
            .replace(/ +/g, ' ')
            // 清理多余换行
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // 移除行首行尾空格
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            // 移除文档开头和结尾的空白
            .trim();
    }
    
    static async parseFile(file) {
        // 添加文件验证
        if (!file || !file.type || !file.name) {
            throw new Error('无效的文件');
        }
        
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        
        // 检查文件是否损坏
        if (file.size === 0) {
            throw new Error('文件为空或损坏');
        }
        
        try {
            let text = '';
            
            if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                text = await this.parsePDF(file);
            } else if (fileType.includes('word') || 
                      fileType.includes('document') ||
                      fileName.endsWith('.docx') || 
                      fileName.endsWith('.doc')) {
                text = await this.parseWord(file);
            } else {
                throw new Error('不支持的文件格式。仅支持 PDF (.pdf) 和 Word (.doc, .docx) 格式');
            }
            
            // 验证提取的文本
            if (!text || text.trim().length < 10) {
                throw new Error('无法从文件中提取有效内容，请检查文件是否正确或尝试其他格式');
            }
            
            // 检查是否包含有意义的简历内容
            if (!this.isValidResumeContent(text)) {
                throw new Error('文件内容不像是简历，请上传正确的简历文件');
            }
            
            return text;
            
        } catch (error) {
            // 更好的错误处理
            if (error.message.includes('password') || error.message.includes('encrypted')) {
                throw new Error('文件已加密，请上传未加密的文件');
            }
            
            if (error.message.includes('corrupted') || error.message.includes('invalid')) {
                throw new Error('文件已损坏，请尝试重新保存后上传');
            }
            
            throw error;
        }
    }
    
    // 验证是否是有效的简历内容
    static isValidResumeContent(text) {
        const resumeKeywords = [
            // 中文关键词
            '姓名', '电话', '邮箱', '教育', '经历', '技能', '工作', '实习', 
            '项目', '学校', '专业', '大学', '学院', '毕业', '求职', '应聘',
            // 英文关键词
            'name', 'phone', 'email', 'education', 'experience', 'skills',
            'work', 'university', 'college', 'graduate', 'internship', 'project'
        ];
        
        const lowerText = text.toLowerCase();
        const matchCount = resumeKeywords.filter(keyword => 
            lowerText.includes(keyword.toLowerCase())
        ).length;
        
        // 至少包含3个简历相关关键词
        return matchCount >= 3;
    }
    
    // 获取文件信息
    static getFileInfo(file) {
        return {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified),
            sizeFormatted: this.formatFileSize(file.size)
        };
    }
    
    // 格式化文件大小
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // 批量处理文件（为将来扩展准备）
    static async parseMultipleFiles(files) {
        const results = [];
        
        for (const file of files) {
            try {
                const text = await this.parseFile(file);
                const info = this.getFileInfo(file);
                results.push({
                    success: true,
                    file: info,
                    text: text
                });
            } catch (error) {
                const info = this.getFileInfo(file);
                results.push({
                    success: false,
                    file: info,
                    error: error.message
                });
            }
        }
        
        return results;
    }
}

// 导出为全局变量（兼容性）
window.ResumeParser = ResumeParser;
