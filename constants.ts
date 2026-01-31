
import { Language, ModelProvider } from './types';

export const GEMINI_MODELS = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro Preview' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash Preview' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Fallback/Preview)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];

// SiliconFlow specific model IDs - Updated to support V3.2 and others
export const DEEPSEEK_MODELS = [
  { value: 'deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek-V3.2 (Default)' },
  { value: 'deepseek-ai/DeepSeek-V3.1-Terminus', label: 'DeepSeek-V3.1-Terminus' },
  { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3' },
  { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek-R1' },
];

export const TRANSLATIONS = {
  zh: {
    nav: {
      job: '岗位配置',
      resume: '简历导入',
      metrics: '分析指标',
      dashboard: '数据统计',
      settings: '系统设置',
      logs: '系统日志',
      help: '使用帮助',
    },
    job: {
      title: '岗位配置',
      positionName: '岗位名称',
      jdLabel: '职位描述 (JD)',
      jdPlaceholder: '请在此处粘贴招聘需求...',
      save: '保存配置',
    },
    resume: {
      title: '简历导入',
      uploadTitle: '上传简历文件',
      dragDrop: '点击或拖拽文件到此处',
      supportedFormats: '支持 PDF, Word (docx), Excel (xlsx), TXT',
      processing: '正在解析',
      success: '解析成功',
      failed: '解析失败',
      addBtn: '上传文件',
      listTitle: '待分析简历',
      clear: '清空列表',
    },
    metrics: {
      title: '分析指标配置',
      addMetric: '添加指标',
      totalWeight: '总权重',
      alertWeight: '总权重必须等于 100%',
      name: '指标名称',
      desc: '评估标准提示词',
      weight: '权重 (%)',
    },
    dashboard: {
      title: '评估报告',
      startAnalysis: '开始AI分析',
      analyzing: '分析中',
      progress: '分析进度',
      exportReport: '导出评估报告',
      exportGuide: '导出面试指南',
      genInterview: '生成面试题',
      totalScore: '总分',
      viewDetail: '详情',
      filter: '筛选/排序',
      noData: '暂无分析数据',
      columns: {
          rank: '排名',
          candidate: '候选人',
          score: '总分',
          summary: '评价摘要',
          actions: '详情/导出'
      },
      charts: {
          dist: '分数分布',
          top: '最佳候选人'
      }
    },
    settings: {
      title: '系统设置',
      language: '语言',
      modelConfig: '模型配置',
      provider: 'AI提供商',
      apiKey: 'API密钥',
      baseUrl: 'API地址 (硅基流动)',
      save: '保存设置',
      timeSync: '系统时间校准',
      currentTime: '当前基准时间',
      timeDesc: '该时间将作为AI分析简历时的“当前时间”，用于计算工龄和空窗期。',
      customModel: '模型名称 (支持手动输入)',
    },
    common: {
      success: '操作成功',
      error: '发生错误',
      delete: '删除',
      edit: '编辑',
      cancel: '取消',
      confirm: '确定',
      close: '关闭',
    },
    help: {
      title: '快速上手指南',
      step1: '1. 配置岗位',
      step1Desc: '输入岗位名称和JD，这是AI评估的基准。',
      step2: '2. 导入简历',
      step2Desc: '上传候选人简历文件，支持批量上传与自动解析。',
      step3: '3. 开始分析',
      step3Desc: '在“数据统计”页面点击“开始AI分析”，观察日志窗口等待完成。',
      step4: '4. 查看与导出',
      step4Desc: '查看详细评分、风险提示，生成面试题并导出PDF报告。',
    }
  },
  en: {
    nav: {
      job: 'Job Config',
      resume: 'Import Resume',
      metrics: 'Metrics',
      dashboard: 'Dashboard',
      settings: 'Settings',
      logs: 'System Logs',
      help: 'Help',
    },
    job: {
      title: 'Job Configuration',
      positionName: 'Position Title',
      jdLabel: 'Job Description (JD)',
      jdPlaceholder: 'Paste the job description here...',
      save: 'Save Configuration',
    },
    resume: {
      title: 'Resume Import',
      uploadTitle: 'Upload Resumes',
      dragDrop: 'Click or Drag files here',
      supportedFormats: 'Supports PDF, Word (docx), Excel (xlsx), TXT',
      processing: 'Parsing',
      success: 'Success',
      failed: 'Failed',
      addBtn: 'Upload Files',
      listTitle: 'Resumes Queue',
      clear: 'Clear List',
    },
    metrics: {
      title: 'Analysis Metrics',
      addMetric: 'Add Metric',
      totalWeight: 'Total Weight',
      alertWeight: 'Total weight must be 100%',
      name: 'Metric Name',
      desc: 'Evaluation Prompt',
      weight: 'Weight (%)',
    },
    dashboard: {
      title: 'Assessment Report',
      startAnalysis: 'Start Analysis',
      analyzing: 'Analyzing',
      progress: 'Progress',
      exportReport: 'Export Report',
      exportGuide: 'Export Guide',
      genInterview: 'Interview Guide',
      totalScore: 'Score',
      viewDetail: 'Detail',
      filter: 'Filter/Sort',
      noData: 'No analysis data',
      columns: {
          rank: 'Rank',
          candidate: 'Candidate',
          score: 'Score',
          summary: 'Summary',
          actions: 'Detail/Export'
      },
      charts: {
          dist: 'Score Distribution',
          top: 'Top Candidate'
      }
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      modelConfig: 'Model Config',
      provider: 'AI Provider',
      apiKey: 'API Key',
      baseUrl: 'Base URL (SiliconFlow)',
      save: 'Save Settings',
      timeSync: 'Time Synchronization',
      currentTime: 'Current Ref Time',
      timeDesc: 'This date is used by AI as "Today" to calculate tenure and employment gaps.',
      customModel: 'Model Name (Supports manual input)',
    },
    common: {
      success: 'Success',
      error: 'Error',
      delete: 'Delete',
      edit: 'Edit',
      cancel: 'Cancel',
      confirm: 'Confirm',
      close: 'Close',
    },
    help: {
      title: 'Quick Start Guide',
      step1: '1. Configure Job',
      step1Desc: 'Enter Job Title and JD. This is the baseline for AI evaluation.',
      step2: '2. Import Resumes',
      step2Desc: 'Upload candidate resume files. Supports batch processing.',
      step3: '3. Start Analysis',
      step3Desc: 'Go to "Dashboard", click "Start Analysis", and watch the logs.',
      step4: '4. Review & Export',
      step4Desc: 'Check scores, risks, generate interview questions, and export PDFs.',
    }
  }
};
