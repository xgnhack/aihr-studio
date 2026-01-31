# AIHR Studio

<div align="center">
  <!-- 如果有Logo或Banner图片，可以在这里替换 -->
  <!-- <img src="your-banner-url.png" alt="AIHR Studio Banner" width="100%" /> -->
</div>

## 📖 项目简介 | Introduction

**AIHR Studio** 是一款专为HR和求职者设计的智能化简历分析工具。

- **对于HR**：它是一个高效的批量简历筛选助手，能够根据自定义的招聘指标，利用先进的AI大模型快速筛选出最合适的候选人，并生成专业的面试建议。
- **对于个人用户**：它是一个强大的简历诊断工具，帮助你分析简历内容是否匹配目标岗位要求，提供优化建议。

本项目支持接入 **Google Gemini** 和 **DeepSeek** 等主流大语言模型，确保分析结果的准确性与深度。

## ✨ 核心功能 | Features

- **🤖 多模型支持**：支持接入 Gemini (Google) 或 DeepSeek 大模型，灵活选择最适合您的AI服务。
- **📊 批量智能筛选**：上传多份简历，AI根据设定的岗位要求（JD）和评分维度自动打分、排序。
- **📝 深度简历诊断**：生成详尽的分析报告，指出简历中的亮点、不足以及潜在风险（如履历造假风险）。
- **❓ 面试出题建议**：根据候选人简历内容和岗位描述，自动生成针对性的面试问题及评估要点。
- **📈 可视化报表**：直观的图表展示候选人能力模型，帮助快速决策。
- **🌍 多语言支持**：支持简体中文和英文界面及分析报告。
- **🔒 隐私安全**：支持本地部署，API Key 本地存储，保障数据安全。

## 🛠️ 技术栈 | Tech Stack

- **前端框架**: [React 19](https://react.dev/) + TypeScript
- **构建工具**: [Vite](https://vitejs.dev/)
- **UI 组件**: Tailwind CSS + Lucide React
- **AI 集成**: Google GenAI SDK
- **文件处理**: Mammoth (Docx), PDF.js (PDF), SheetJS (Excel)
- **图表**: Recharts

## 📦 下载与安装 | Download & Installation

### Windows 用户 (推荐)

如果您没有编程基础，或者只想快速使用本软件，请直接下载我们为您打包好的 Windows 绿色版程序：

1.  访问本项目的 [Releases 页面](https://github.com/xgnhack/aihr-studio/releases)。
2.  下载最新版本的 `AIHR_Studio_Windows_v1.1.2.zip` 压缩包。
3.  解压压缩包到任意文件夹。
4.  双击运行文件夹中的 **`AIHR Studio.exe`** 即可启动。

### macOS 用户

我们提供了适配 macOS (Apple Silicon / M系列芯片) 的应用程序：

1.  访问本项目的 [Releases 页面](https://github.com/xgnhack/aihr-studio/releases)。
2.  下载 `AIHR_Studio_Mac_Arm64_v1.1.2.zip` (或 dmg 文件)。
3.  解压或安装后即可运行。
    *   *注意：如果提示“无法打开，因为无法验证开发者”，请在“系统设置” -> “隐私与安全性”中允许运行。*

## 🚀 开发指南 | Development

### 环境要求 | Prerequisites

- [Node.js](https://nodejs.org/) (建议 v18 或更高版本)
- npm 或 yarn

### 安装步骤 | Installation

1. **克隆项目到本地**
   ```bash
   git clone https://github.com/xgnhack/aihr-studio.git
   cd aihr-studio
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **打开应用**
   浏览器访问控制台输出的地址（通常是 `http://localhost:5173`）。

## ⚙️ 配置说明 | Configuration

首次运行应用时，请点击右上角的 **设置 (Settings)** 图标进行配置：

1. **选择模型提供商 (Provider)**：
   - **Gemini**: 需要提供 Google AI Studio 的 API Key。
   - **DeepSeek**: 需要提供 DeepSeek 的 API Key（支持自定义 Base URL）。

2. **输入 API Key**:
   - 将您的 API Key 填入对应输入框。
   - *提示：Key 仅保存在您本地浏览器的 LocalStorage 中，不会上传至服务器。*

3. **设置语言**:
   - 可在设置中切换 简体中文 / English。

## 📖 使用指南 | Usage

1. **配置岗位 (Job Setup)**：输入职位名称和详细的职位描述 (JD)。
2. **设定指标 (Metrics)**：定义筛选维度的权重（如：技术能力、经验匹配度、学历背景等）。
3. **上传简历 (Upload)**：支持 PDF、Word (docx) 等格式的批量上传。
4. **开始分析 (Analyze)**：点击分析按钮，AI 将自动处理所有简历。
5. **查看报告 (Report)**：点击候选人查看详细评分、风险提示及面试题建议。

## 🤝 贡献 | Contributing

欢迎提交 Pull Request 或 Issue 来帮助改进这个项目！

## 📄 许可证 | License

[MIT License](LICENSE)
