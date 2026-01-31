import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, FileText, BarChart2, Settings as SettingsIcon, Sliders, Play, Trash2, Download, FileQuestion, Upload, Plus, AlertCircle, CheckCircle, FileUp, Loader2, Globe, Check, Save, AlertTriangle, Clock, HelpCircle, Terminal, Sparkles, FileSearch, ExternalLink, Github } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

import { AppSettings, Candidate, JobConfig, Metric, DEFAULT_METRICS, Language, ModelProvider, AnalysisResult, LogEntry } from './types';
import { TRANSLATIONS, GEMINI_MODELS, DEEPSEEK_MODELS } from './constants';
import { analyzeResume, generateInterviewQuestions, enrichAnalysis } from './services/aiService';
import { parseFile } from './services/fileParser';

// --- Local Storage Key ---
const STORAGE_KEY = 'AIHR_STUDIO_DATA_V1';

// --- Components ---

interface FileProcessStatus {
    id: string;
    name: string;
    status: 'processing' | 'success' | 'error';
    errorMsg?: string;
}

// --- Helper Component: Markdown Line Renderer ---
// Renders a single line of Markdown to allow for granular pagination control
const MarkdownLineRenderer = ({ line }: { line: string }) => {
    const trimmed = line.trim();
    
    // 1. Headers (###)
    if (trimmed.startsWith('### ')) {
        return <h3 className="text-lg font-bold text-slate-800 mt-4 mb-2">{parseInlineStyles(trimmed.replace(/^###\s+/, ''))}</h3>;
    }
    if (trimmed.startsWith('## ')) {
        return <h2 className="text-xl font-bold text-slate-800 mt-5 mb-3 border-b pb-1">{parseInlineStyles(trimmed.replace(/^##\s+/, ''))}</h2>;
    }
    
    // 2. Horizontal Rule (---)
    if (trimmed === '---' || trimmed === '***') {
        return <hr className="my-4 border-slate-200" />;
    }

    // 3. Lists (- or *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
            <div className="flex gap-2 ml-2 mb-1">
                <span className="text-slate-400">•</span>
                <span className="text-sm text-slate-700 leading-relaxed">{parseInlineStyles(trimmed.replace(/^[-*]\s+/, ''))}</span>
            </div>
        );
    }

    // 4. Numbered Lists
    if (/^\d+\.\s/.test(trimmed)) {
            return (
            <div className="flex gap-2 ml-2 font-medium text-slate-800 mt-2 mb-1 text-sm">
                    {parseInlineStyles(trimmed)}
            </div>
            );
    }

    // 5. Empty lines
    if (trimmed === '') {
        return <div className="h-2"></div>;
    }

    // Default Paragraph
    return <p className="text-sm text-slate-700 leading-relaxed mb-1">{parseInlineStyles(line)}</p>;
};

// Helper to handle bold (**text**)
const parseInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

// Kept for modal display (non-PDF)
const MarkdownRenderer = ({ content }: { content: string }) => {
    if (!content) return null;
    return (
        <div className="space-y-1">
            {content.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                    <MarkdownLineRenderer line={line} />
                </React.Fragment>
            ))}
        </div>
    );
}

const ResumeImportView = ({ 
  t, 
  candidates, 
  setCandidates, 
  onAddCandidate
}: { 
  t: any; 
  candidates: Candidate[]; 
  setCandidates: (c: Candidate[]) => void; 
  onAddCandidate: (c: Candidate) => void;
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<FileProcessStatus[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processFiles(Array.from(e.dataTransfer.files));
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          processFiles(Array.from(e.target.files));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = async (files: File[]) => {
      // Add files to queue immediately
      const newQueueItems = files.map(f => ({
          id: `f_${Date.now()}_${Math.random()}`,
          name: f.name,
          status: 'processing' as const,
          fileObject: f
      }));
      
      setUploadQueue(prev => [...newQueueItems, ...prev]);

      // Process individually
      for (const item of newQueueItems) {
          try {
              const { name, text } = await parseFile(item.fileObject);
              
              onAddCandidate({
                  id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  name: name,
                  rawText: text,
                  status: 'pending'
              });

              setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));

          } catch (err) {
              console.error(`Error parsing file ${item.name}`, err);
              setUploadQueue(prev => prev.map(q => q.id === item.id ? { 
                  ...q, 
                  status: 'error', 
                  errorMsg: (err as Error).message 
              } : q));
          }
      }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-800">{t.resume.title}</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-[400px]">
                <h3 className="font-medium text-slate-700 mb-4">{t.resume.uploadTitle}</h3>
                
                <div 
                    className={`border-2 border-dashed rounded-xl flex flex-col justify-center items-center p-8 transition-colors cursor-pointer mb-6 ${
                        isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        multiple 
                        accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.md"
                    />
                    
                    <div className="text-center">
                        <div className="bg-blue-100 p-4 rounded-full inline-block mb-4">
                            <FileUp size={40} className="text-blue-600" />
                        </div>
                        <p className="text-lg font-medium text-slate-700 mb-2">{t.resume.dragDrop}</p>
                        <p className="text-sm text-slate-400">{t.resume.supportedFormats}</p>
                    </div>
                </div>

                {/* Upload Progress Queue */}
                {uploadQueue.length > 0 && (
                    <div className="flex-1 overflow-y-auto max-h-[250px] space-y-2 pr-2 border-t border-slate-100 pt-4">
                        {uploadQueue.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-2 truncate max-w-[70%]">
                                    <FileText size={16} className="text-slate-400" />
                                    <span className="truncate text-slate-700" title={item.name}>{item.name}</span>
                                </div>
                                <div>
                                    {item.status === 'processing' && (
                                        <span className="flex items-center gap-1 text-blue-600 text-xs font-medium">
                                            <Loader2 size={12} className="animate-spin" /> {t.resume.processing}
                                        </span>
                                    )}
                                    {item.status === 'success' && (
                                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                            <CheckCircle size={12} /> {t.resume.success}
                                        </span>
                                    )}
                                    {item.status === 'error' && (
                                        <span className="flex items-center gap-1 text-red-500 text-xs font-medium" title={item.errorMsg}>
                                            <AlertCircle size={12} /> {t.resume.failed}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-700">{t.resume.listTitle} ({candidates.length})</h3>
                <button onClick={() => setCandidates([])} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1">
                    <Trash2 size={16}/> {t.resume.clear}
                </button>
            </div>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                {candidates.map((c, i) => (
                    <div key={c.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="font-medium text-slate-800 truncate" title={c.name}>{c.name}</div>
                            <div className="text-xs text-slate-500 truncate">
                                {c.rawText.substring(0, 60)}...
                            </div>
                        </div>
                        <div className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                            c.status === 'completed' ? 'bg-green-100 text-green-700' :
                            c.status === 'failed' ? 'bg-red-100 text-red-700' :
                            c.status === 'analyzing' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                            {c.status}
                        </div>
                    </div>
                ))}
                {candidates.length === 0 && (
                    <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        {t.dashboard.noData}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

// --- Helper for Name Cleaning ---
const cleanCandidateName = (aiName: string | undefined, fileName: string): string => {
    // 1. Initial source: Prefer AI name if it's not empty/unknown, else use filename
    let raw = (aiName && aiName.trim().length > 0 && aiName.toLowerCase() !== 'unknown') ? aiName : fileName;

    // 2. Remove File Extensions (if any)
    raw = raw.replace(/\.[^/.]+$/, "");

    // 3. Remove content inside brackets: [Job], 【Role】, (1)
    // This targets common filename patterns like "【新媒体】张三 (1)"
    raw = raw.replace(/\[.*?\]/g, " ").replace(/【.*?】/g, " ").replace(/\(.*?\)/g, " ");

    // 4. Remove common keywords
    raw = raw.replace(/简历|Resume|Curriculum Vitae|CV|Job|Application/gi, " ");

    // 5. Remove digits (often version numbers or phone fragments)
    raw = raw.replace(/\d+/g, "");

    // 6. Cleanup whitespace
    let clean = raw.trim().replace(/\s+/g, " ");

    // 7. CHINESE NAME HEURISTIC (User Requested)
    // If the remaining string contains Chinese characters
    const chineseMatches = clean.match(/[\u4e00-\u9fa5]+/g);
    if (chineseMatches) {
        // Look for a segment that is 2-4 characters long.
        // This effectively extracts "张三" from "张三 经理" or "曹晓凤" from a messy string.
        const nameCandidates = chineseMatches.filter(m => m.length >= 2 && m.length <= 4);
        
        if (nameCandidates.length > 0) {
            // Return the first valid looking Chinese name sequence
            // We prioritize this over the full string if the full string is messy
            return nameCandidates[0];
        }
        
        // If we found Chinese chars but they were long (e.g. "欧阳娜娜娜"), just return the full Chinese part
        if (chineseMatches.length > 0) {
            return chineseMatches.join(""); 
        }
    }

    return clean;
};

// Helper for element height calculation including margins
const getElementHeight = (el: HTMLElement) => {
    const style = window.getComputedStyle(el);
    const marginTop = parseFloat(style.marginTop) || 0;
    const marginBottom = parseFloat(style.marginBottom) || 0;
    // offsetHeight includes border + padding
    return el.offsetHeight + marginTop + marginBottom;
};

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'job' | 'resume' | 'metrics' | 'dashboard' | 'settings'>('settings');
  
  const [settings, setSettings] = useState<AppSettings>({
    language: 'zh',
    geminiKey: '',
    deepSeekKey: '',
    deepSeekBaseUrl: 'https://api.siliconflow.cn/v1',
    provider: ModelProvider.Gemini,
    selectedModel: 'gemini-3-flash-preview',
    systemDate: new Date().toISOString().split('T')[0]
  });

  const [jobConfig, setJobConfig] = useState<JobConfig>({ title: '', description: '' });
  const [metrics, setMetrics] = useState<Metric[]>(DEFAULT_METRICS);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [modalCandidate, setModalCandidate] = useState<Candidate | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false); // NEW: State for enrichment
  
  // New States for features
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Feedback States
  const [jobSaveStatus, setJobSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saved'>('idle');
  
  // Ref for PDF export container
  const pdfExportRef = useRef<HTMLDivElement>(null);
  const [exportData, setExportData] = useState<{candidate: Candidate, type: 'report' | 'guide'} | null>(null);

  const t = TRANSLATIONS[settings.language];

  // --- Helpers ---
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
      setLogs(prev => [...prev, {
          id: Date.now().toString() + Math.random(),
          timestamp: new Date().toLocaleTimeString(),
          message,
          type
      }]);
  };

  // Scroll logs to bottom
  useEffect(() => {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // --- Effects ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.settings) {
            setSettings({
                ...data.settings,
                deepSeekBaseUrl: data.settings.deepSeekBaseUrl || 'https://api.siliconflow.cn/v1',
                systemDate: data.settings.systemDate || new Date().toISOString().split('T')[0]
            });
        }
        if (data.jobConfig) setJobConfig(data.jobConfig);
        if (data.metrics) setMetrics(data.metrics);
        if (data.candidates) setCandidates(data.candidates);
      } catch (e) {
        console.error("Failed to load local data", e);
      }
    }
  }, []);

  useEffect(() => {
    const data = { settings, jobConfig, metrics, candidates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [settings, jobConfig, metrics, candidates]);

  // --- SMART PDF EXPORT LOGIC ---
  useEffect(() => {
    if (exportData && pdfExportRef.current) {
        const generate = async () => {
            const container = pdfExportRef.current!;
            // Wait for React to render
            await new Promise(resolve => setTimeout(resolve, 300));

            try {
                addLog(`Generating PDF for ${exportData.candidate.name}...`, 'process');

                // A4 dimensions in mm
                const PAGE_WIDTH_MM = 210;
                const PAGE_HEIGHT_MM = 297;
                const MARGIN_TOP_MM = 20;
                const MARGIN_BOTTOM_MM = 20;
                const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;

                // Create PDF
                const pdf = new jsPDF('p', 'mm', 'a4');
                const docWidth = pdf.internal.pageSize.getWidth();
                const docHeight = pdf.internal.pageSize.getHeight();

                // Calculate px per mm conversion based on the rendered container width
                const containerWidthPx = container.offsetWidth;
                const pxPerMm = containerWidthPx / PAGE_WIDTH_MM;
                
                // Subtract a 5mm buffer for safety against cutting
                const maxContentHeightPx = (CONTENT_HEIGHT_MM - 5) * pxPerMm;

                // Identify Atomic Blocks (children of the container)
                // The template is flattened now, so children are granular (headers, paragraphs, table rows)
                const children = Array.from(container.children) as HTMLElement[];

                const pages: HTMLElement[][] = [];
                let currentPage: HTMLElement[] = [];
                let currentHeight = 0;

                // 1. Pagination Algorithm: Group elements into pages
                for (const child of children) {
                    const h = getElementHeight(child);
                    
                    if (currentHeight + h > maxContentHeightPx && currentPage.length > 0) {
                        // Push current page
                        pages.push(currentPage);
                        // Start new page with this element
                        currentPage = [child];
                        currentHeight = h;
                    } else {
                        currentPage.push(child);
                        currentHeight += h;
                    }
                }
                if (currentPage.length > 0) pages.push(currentPage);

                // 2. Render each page group to Canvas
                // We need a temporary visible container to render these groups accurately with styles
                const tempContainer = document.createElement('div');
                // Ensure temp container matches the main container width and base styles
                tempContainer.style.width = `${container.offsetWidth}px`;
                tempContainer.style.position = 'absolute';
                tempContainer.style.left = '-9999px';
                tempContainer.style.top = '0';
                tempContainer.style.backgroundColor = '#ffffff';
                // Copy base class (e.g., text-slate-900), but ENSURE no vertical padding is added
                tempContainer.className = container.className; 
                tempContainer.style.padding = '0'; // Force 0 padding for accurate height mapping
                tempContainer.style.margin = '0';

                document.body.appendChild(tempContainer);

                // Process pages sequentially
                for (let i = 0; i < pages.length; i++) {
                    const pageNodes = pages[i];
                    
                    // Clear and fill temp container
                    tempContainer.innerHTML = '';
                    pageNodes.forEach(node => {
                        // Clone deeply to keep styles/content
                        const clone = node.cloneNode(true) as HTMLElement;
                        // Prevent top margin on the first element of the page to respect the PDF header margin
                        if (node === pageNodes[0]) {
                            clone.style.marginTop = '0';
                        }
                        tempContainer.appendChild(clone);
                    });

                    // Snapshot
                    const canvas = await html2canvas(tempContainer, {
                        scale: 2, // Retain high quality
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                    });

                    // Add to PDF
                    if (i > 0) pdf.addPage();

                    const imgData = canvas.toDataURL('image/png');
                    // Calculate scaled height based on PDF width
                    const imgHeight = (canvas.height * docWidth) / canvas.width;
                    
                    // Add Main Content Image (Offset by Margin Top)
                    pdf.addImage(imgData, 'PNG', 0, MARGIN_TOP_MM, docWidth, imgHeight);

                    // --- Add Header ---
                    // FIX BUG 1: Remove Candidate Name from here to avoid Mojibake (Encoding issues) with jsPDF default fonts
                    // Use standard English header title + Date only
                    pdf.setFontSize(9);
                    pdf.setTextColor(100, 116, 139); // Slate-500
                    // Left
                    pdf.text("AIHR Studio Evaluation", 10, 12);
                    // Right
                    // Instead of candidate.name, use generic 'Report' or just date. 
                    // To be safe with encoding, we avoid Chinese characters here.
                    const headerRight = `Report | ${new Date().toLocaleDateString('en-CA')}`;
                    const textWidth = pdf.getTextWidth(headerRight);
                    pdf.text(headerRight, docWidth - 10 - textWidth, 12);
                    // Line
                    pdf.setDrawColor(226, 232, 240); // Slate-200
                    pdf.line(10, 15, docWidth - 10, 15);

                    // --- Add Footer ---
                    pdf.setDrawColor(226, 232, 240);
                    pdf.line(10, docHeight - 15, docWidth - 10, docHeight - 15);
                    
                    const pageNumStr = `Page ${i + 1} of ${pages.length}`;
                    pdf.setFontSize(8);
                    const pageNumWidth = pdf.getTextWidth(pageNumStr);
                    pdf.text(pageNumStr, (docWidth - pageNumWidth) / 2, docHeight - 10);
                }

                // Cleanup
                document.body.removeChild(tempContainer);

                // Save
                const typeStr = exportData.type === 'report' ? (settings.language === 'zh' ? '简历分析' : 'Analysis') : (settings.language === 'zh' ? '面试指南' : 'InterviewGuide');
                const jobStr = jobConfig.title || 'Job';
                const nameStr = exportData.candidate.name || 'Candidate';
                const scoreStr = exportData.candidate.analysis?.totalScore || '0';
                
                pdf.save(`${typeStr}_${jobStr}_${nameStr}_${scoreStr}.pdf`);
                addLog(`PDF exported successfully: ${nameStr} (${pages.length} pages)`, 'success');

            } catch (e) {
                console.error("PDF Generation failed", e);
                alert("Failed to generate PDF. Please try again.");
                addLog(`PDF export failed for ${exportData.candidate.name}`, 'error');
            } finally {
                setExportData(null); 
            }
        };
        // Small timeout to allow DOM update
        setTimeout(generate, 100);
    }
  }, [exportData]);

  // --- Handlers ---
  
  const handleAddCandidate = (newCandidate: Candidate) => {
      // Clean the initial filename slightly for display, but full processing happens after AI
      const cleanDisplay = cleanCandidateName(undefined, newCandidate.name);
      setCandidates(prev => [...prev, { ...newCandidate, name: cleanDisplay }]);
      addLog(`Loaded resume: ${cleanDisplay}`, 'info');
  };

  const handleStartAnalysis = async () => {
    if (!jobConfig.description) {
      alert(settings.language === 'zh' ? '请先配置岗位JD' : 'Please configure Job Description first');
      setActiveTab('job');
      return;
    }

    const totalWeight = metrics.reduce((acc, m) => acc + m.weight, 0);
    if (totalWeight !== 100) {
       alert(t.metrics.alertWeight);
       setActiveTab('metrics');
       return;
    }

    const queue = candidates.filter(c => c.status === 'pending' || c.status === 'failed');
    if (queue.length === 0) {
        alert(settings.language === 'zh' ? '没有待分析的简历' : 'No pending resumes to analyze');
        return;
    }

    setIsProcessing(true);
    setAnalysisProgress({ current: 0, total: queue.length });
    addLog(`Starting analysis batch. Queue size: ${queue.length}`, 'process');

    const BATCH_SIZE = 1; // Serial processing
    const currentDateStr = settings.systemDate || new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < queue.length; i += BATCH_SIZE) {
        const batch = queue.slice(i, i + BATCH_SIZE);
        
        // Mark batch as analyzing
        setCandidates(prev => prev.map(c => 
            batch.find(b => b.id === c.id) ? { ...c, status: 'analyzing' } : c
        ));

        await Promise.all(batch.map(async (cand) => {
            addLog(`Analyzing: ${cand.name}...`, 'process');
            try {
                const result = await analyzeResume(cand, jobConfig, metrics, settings, currentDateStr);
                
                let calculatedTotal = 0;
                const scoreMap: Record<string, number> = {};
                const reasonMap: Record<string, string> = {};
                
                if (Array.isArray(result.scores)) {
                    result.scores.forEach((s: any) => {
                        scoreMap[s.metricId] = s.score;
                        const weight = metrics.find(m => m.id === s.metricId)?.weight || 0;
                        calculatedTotal += (s.score * weight) / 100;
                    });
                }
                
                if (Array.isArray(result.reasons)) {
                     result.reasons.forEach((r: any) => reasonMap[r.metricId] = r.reason);
                }

                const analysis: AnalysisResult = {
                    scores: scoreMap,
                    reasons: reasonMap,
                    totalScore: Math.round(calculatedTotal * 10) / 10,
                    summary: result.summary || "No summary provided.",
                    risks: result.risks || []
                };

                const updatedInfo = result.candidateInfo || {};
                
                // --- Fix for Name Extraction ---
                // Use the new cleaning logic
                const rawAIName = updatedInfo.name;
                const finalName = cleanCandidateName(rawAIName, cand.name);

                // Update individual candidate
                setCandidates(prev => prev.map(c => c.id === cand.id ? {
                    ...c,
                    status: 'completed',
                    name: finalName, // Use cleaned name
                    age: updatedInfo.age || c.age,
                    company: updatedInfo.company || c.company,
                    education: updatedInfo.education || c.education,
                    phone: updatedInfo.phone || c.phone,
                    analysis
                } : c));

                addLog(`Completed: ${finalName} (Score: ${analysis.totalScore})`, 'success');

            } catch (err) {
                console.error(`Analysis failed for ${cand.name}`, err);
                setCandidates(prev => prev.map(c => c.id === cand.id ? { ...c, status: 'failed' } : c));
                addLog(`Failed: ${cand.name} - ${(err as Error).message}`, 'error');
            }
        }));

        setAnalysisProgress(prev => ({ ...prev, current: Math.min(prev.current + BATCH_SIZE, prev.total) }));
    }
    
    setIsProcessing(false);
    addLog(`Analysis batch completed.`, 'success');
  };

  // NEW: Handler for Deep Analysis
  const handleEnrichAnalysis = async (candidate: Candidate) => {
      setIsEnriching(true);
      addLog(`Enriching analysis for ${candidate.name}...`, 'process');
      
      try {
          const detailed = await enrichAnalysis(candidate, jobConfig, metrics, settings);
          
          setCandidates(prev => prev.map(c => c.id === candidate.id ? {
              ...c,
              analysis: c.analysis ? { ...c.analysis, detailedMetrics: detailed } : undefined
          } : c));
          
          if (modalCandidate && modalCandidate.id === candidate.id) {
              setModalCandidate(prev => prev ? {
                  ...prev,
                   analysis: prev.analysis ? { ...prev.analysis, detailedMetrics: detailed } : undefined
              } : null);
          }
          addLog(`Deep analysis completed for ${candidate.name}`, 'success');
      } catch (e) {
          addLog(`Failed deep analysis for ${candidate.name}: ${(e as Error).message}`, 'error');
      } finally {
          setIsEnriching(false);
      }
  };

  const generateInterview = async (candidate: Candidate) => {
      setInterviewLoading(true);
      addLog(`Generating interview questions for ${candidate.name}...`, 'process');
      const currentDateStr = settings.systemDate || new Date().toISOString().split('T')[0];

      try {
          const guide = await generateInterviewQuestions(candidate, jobConfig, settings, currentDateStr);
          setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, interviewGuide: guide } : c));
          
          if (modalCandidate && modalCandidate.id === candidate.id) {
              setModalCandidate({ ...candidate, interviewGuide: guide });
          }
          addLog(`Interview guide generated for ${candidate.name}`, 'success');
      } catch (e) {
          addLog(`Failed to generate interview guide for ${candidate.name}`, 'error');
          alert('Failed to generate interview questions');
      } finally {
          setInterviewLoading(false);
      }
  };

  const triggerPDFExport = (candidate: Candidate, type: 'report' | 'guide') => {
      setExportData({ candidate, type });
  };
  
  const handleSaveJobConfig = () => {
      setJobSaveStatus('saving');
      setTimeout(() => {
          setJobSaveStatus('saved');
          setTimeout(() => setJobSaveStatus('idle'), 2000);
      }, 500);
  };

  const handleSaveSettings = () => {
      setSettingsSaveStatus('saved');
      setTimeout(() => setSettingsSaveStatus('idle'), 2000);
  };

  // --- Views ---

  const renderSidebar = () => (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-10 shadow-xl">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">
            AIHR Studio
        </h1>
        <p className="text-xs text-slate-400 mt-1">Intelligent Screening</p>
      </div>
      
      <nav className="flex-none p-4 space-y-2">
        <NavItem id="settings" icon={<SettingsIcon size={20}/>} label={t.nav.settings} active={activeTab} set={setActiveTab} />
        <NavItem id="job" icon={<Briefcase size={20}/>} label={t.nav.job} active={activeTab} set={setActiveTab} />
        <NavItem id="resume" icon={<Upload size={20}/>} label={t.nav.resume} active={activeTab} set={setActiveTab} />
        <NavItem id="metrics" icon={<Sliders size={20}/>} label={t.nav.metrics} active={activeTab} set={setActiveTab} />
        <NavItem id="dashboard" icon={<BarChart2 size={20}/>} label={t.nav.dashboard} active={activeTab} set={setActiveTab} />
      </nav>
      
      {/* Log Window */}
      <div className="flex-1 flex flex-col min-h-0 px-4 pb-2">
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-400 uppercase font-semibold">
              <Terminal size={12} /> {t.nav.logs}
          </div>
          <div className="flex-1 bg-slate-800 rounded-lg p-2 overflow-y-auto font-mono text-[10px] space-y-1.5 border border-slate-700 shadow-inner">
              {logs.length === 0 && <div className="text-slate-600 italic text-center mt-4">System ready...</div>}
              {logs.map((log) => (
                  <div key={log.id} className={`${
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-green-400' : 
                      log.type === 'process' ? 'text-blue-400' : 'text-slate-300'
                  }`}>
                      <span className="opacity-50">[{log.timestamp}]</span> {log.message}
                  </div>
              ))}
              <div ref={logsEndRef} />
          </div>
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between mb-3">
             <button 
                 onClick={() => setShowHelp(true)}
                 className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition"
             >
                 <HelpCircle size={14} /> {t.nav.help}
             </button>
        </div>
        <div className="flex bg-slate-700 rounded-lg p-1 mb-2">
            <button 
                onClick={() => setSettings({...settings, language: 'zh'})}
                className={`flex-1 text-xs py-1.5 rounded-md transition-all ${settings.language === 'zh' ? 'bg-slate-500 text-white font-medium shadow' : 'text-slate-400 hover:text-white'}`}
            >
                中文
            </button>
            <button 
                onClick={() => setSettings({...settings, language: 'en'})}
                className={`flex-1 text-xs py-1.5 rounded-md transition-all ${settings.language === 'en' ? 'bg-slate-500 text-white font-medium shadow' : 'text-slate-400 hover:text-white'}`}
            >
                EN
            </button>
        </div>
        <div className="text-[10px] text-slate-500 text-center flex flex-col items-center gap-1">
             <span>v1.1.2 | Custom Model</span>
             <a 
                href="https://github.com/xgnhack/aihr-studio" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-blue-400 transition-colors"
             >
                <Github size={10} /> GitHub
             </a>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-800 mb-6">{t.settings.title}</h2>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="border-b border-slate-100 pb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.provider}</label>
                <select 
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 mb-4"
                    value={settings.provider}
                    onChange={(e) => {
                        const newProvider = e.target.value as ModelProvider;
                        // Determine default model based on provider
                        const defaultModel = newProvider === ModelProvider.Gemini 
                            ? GEMINI_MODELS[0].value 
                            : DEEPSEEK_MODELS[0].value; // Defaults to V3.2
                        setSettings({
                            ...settings, 
                            provider: newProvider,
                            selectedModel: defaultModel
                        });
                    }}
                >
                    <option value={ModelProvider.Gemini}>Google Gemini</option>
                    <option value={ModelProvider.DeepSeek}>DeepSeek (SiliconFlow)</option>
                </select>

                <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.modelConfig}</label>
                
                {settings.provider === ModelProvider.Gemini ? (
                    <select 
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 mb-4"
                        value={settings.selectedModel}
                        onChange={(e) => setSettings({...settings, selectedModel: e.target.value})}
                    >
                        {GEMINI_MODELS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                ) : (
                    <div className="mb-4">
                        <input 
                            list="deepseek-models"
                            type="text"
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={settings.selectedModel}
                            onChange={(e) => setSettings({...settings, selectedModel: e.target.value})}
                            placeholder={settings.language === 'zh' ? '输入模型名称 (如 deepseek-ai/DeepSeek-V3)' : 'Enter model name...'}
                        />
                        <datalist id="deepseek-models">
                            {DEEPSEEK_MODELS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </datalist>
                        <p className="text-xs text-slate-500 mt-1">{t.settings.customModel}</p>
                    </div>
                )}

                {settings.provider === ModelProvider.Gemini && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Gemini API Key</label>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                             <button 
                                type="button"
                                onClick={() => window.open('https://aihubmix.com/?aff=Ap9F', '_blank')}
                                className="flex items-center justify-center gap-2 py-2 px-3 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-medium hover:bg-orange-100 transition-colors"
                             >
                                <ExternalLink size={14} />
                                {settings.language === 'zh' ? '获取Key (第三方渠道)' : 'Get Key (3rd Party)'}
                             </button>
                             <a 
                                href="https://aistudio.google.com/api-keys" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-2 px-3 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 hover:text-blue-600 transition-colors"
                             >
                                <Sparkles size={14} className="text-blue-500"/>
                                {settings.language === 'zh' ? '获取Key (官方渠道)' : 'Get Key (Official)'}
                             </a>
                        </div>

                        <input 
                            type="password"
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={settings.geminiKey}
                            onChange={(e) => setSettings({...settings, geminiKey: e.target.value})}
                            placeholder="AIza..."
                        />
                        <p className="text-[10px] text-slate-400 mt-2">
                            {settings.language === 'zh' ? '提示: 官方Key需科学上网。第三方Key通常可直连，适合国内环境。' : 'Tip: Official key might require VPN. 3rd party keys often act as a proxy.'}
                        </p>
                    </div>
                )}

                {settings.provider === ModelProvider.DeepSeek && (
                    <div className="space-y-4">
                        <div>
                             <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-slate-700">SiliconFlow API Key</label>
                                <a 
                                    href="https://cloud.siliconflow.cn/i/JQJY106H" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                >
                                    {settings.language === 'zh' ? '免费获取 API Key' : 'Get Free API Key'} <ExternalLink size={12} />
                                </a>
                            </div>
                            <input 
                                type="password"
                                className="w-full px-4 py-2 rounded-lg border border-slate-300"
                                value={settings.deepSeekKey}
                                onChange={(e) => setSettings({...settings, deepSeekKey: e.target.value})}
                                placeholder="sk-..."
                            />
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-2">{t.settings.baseUrl}</label>
                            <input 
                                className="w-full px-4 py-2 rounded-lg border border-slate-300"
                                value={settings.deepSeekBaseUrl}
                                onChange={(e) => setSettings({...settings, deepSeekBaseUrl: e.target.value})}
                                placeholder="https://api.siliconflow.cn/v1"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Time Sync Section */}
            <div className="border-b border-slate-100 pb-6">
                <div className="flex items-center gap-2 mb-2">
                    <Clock size={18} className="text-slate-500"/>
                    <label className="block text-sm font-medium text-slate-700">{t.settings.timeSync}</label>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 mb-1">{t.settings.currentTime}</div>
                        <div className="text-lg font-bold font-mono text-slate-800">
                            {settings.systemDate}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 max-w-xs">{t.settings.timeDesc}</div>
                    </div>
                    <button 
                        onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            setSettings({...settings, systemDate: today});
                            addLog(`System time synced to: ${today}`, 'success');
                        }}
                        className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-blue-50 hover:border-blue-300 transition text-slate-600"
                    >
                        Sync / Update
                    </button>
                </div>
            </div>
            
            <div className="pt-4 flex justify-end">
                 <button 
                    onClick={handleSaveSettings}
                    className={`px-6 py-2 rounded-lg transition flex items-center gap-2 ${
                        settingsSaveStatus === 'saved' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-slate-800 text-white hover:bg-slate-900'
                    }`}
                >
                    {settingsSaveStatus === 'saved' ? <CheckCircle size={18} /> : <Save size={18} />}
                    {settingsSaveStatus === 'saved' ? (settings.language === 'zh' ? '配置已保存' : 'Settings Saved') : t.settings.save}
                </button>
            </div>
        </div>
    </div>
  );

  const renderHelpModal = () => {
      if (!showHelp) return null;
      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <HelpCircle />
                          <h3 className="text-xl font-bold">{t.help.title}</h3>
                      </div>
                      <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">&times;</button>
                  </div>
                  <div className="p-6 space-y-6">
                      <div className="flex gap-4">
                          <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                          <div>
                              <h4 className="font-bold text-slate-800">{t.help.step1}</h4>
                              <p className="text-sm text-slate-600">{t.help.step1Desc}</p>
                          </div>
                      </div>
                      <div className="flex gap-4">
                          <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                          <div>
                              <h4 className="font-bold text-slate-800">{t.help.step2}</h4>
                              <p className="text-sm text-slate-600">{t.help.step2Desc}</p>
                          </div>
                      </div>
                      <div className="flex gap-4">
                          <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                          <div>
                              <h4 className="font-bold text-slate-800">{t.help.step3}</h4>
                              <p className="text-sm text-slate-600">{t.help.step3Desc}</p>
                          </div>
                      </div>
                      <div className="flex gap-4">
                          <div className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">4</div>
                          <div>
                              <h4 className="font-bold text-slate-800">{t.help.step4}</h4>
                              <p className="text-sm text-slate-600">{t.help.step4Desc}</p>
                          </div>
                      </div>
                  </div>
                  <div className="p-4 bg-slate-50 text-right">
                      <button 
                          onClick={() => setShowHelp(false)} 
                          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm"
                      >
                          {t.common.close}
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  const renderJobConfig = () => (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-800 mb-6">{t.job.title}</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t.job.positionName}</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={jobConfig.title}
            onChange={(e) => setJobConfig({...jobConfig, title: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t.job.jdLabel}</label>
          <textarea 
            className="w-full h-96 px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            placeholder={t.job.jdPlaceholder}
            value={jobConfig.description}
            onChange={(e) => setJobConfig({...jobConfig, description: e.target.value})}
          ></textarea>
        </div>
        <div className="flex justify-end">
            <button 
                onClick={handleSaveJobConfig}
                disabled={jobSaveStatus === 'saving'}
                className={`px-6 py-2 rounded-lg transition flex items-center gap-2 ${
                    jobSaveStatus === 'saved' 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
                {jobSaveStatus === 'saving' && <Loader2 size={18} className="animate-spin" />}
                {jobSaveStatus === 'saved' && <CheckCircle size={18} />}
                {jobSaveStatus === 'idle' && <Save size={18} />}
                
                {jobSaveStatus === 'saved' ? (settings.language === 'zh' ? '已保存' : 'Saved') : t.job.save}
            </button>
        </div>
      </div>
    </div>
  );

  const renderMetrics = () => {
      const totalWeight = metrics.reduce((acc, m) => acc + m.weight, 0);
      
      const updateMetric = (id: string, field: keyof Metric, value: any) => {
          setMetrics(metrics.map(m => m.id === id ? { ...m, [field]: value } : m));
      };

      const removeMetric = (id: string) => {
          setMetrics(metrics.filter(m => m.id !== id));
      };

      const addMetric = () => {
          const newId = `m${Date.now()}`;
          setMetrics([...metrics, { id: newId, name: 'New Metric', description: 'Description...', weight: 0 }]);
      };

      return (
        <div className="max-w-4xl mx-auto">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800">{t.metrics.title}</h2>
                <div className={`text-lg font-bold px-4 py-2 rounded-lg ${totalWeight === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.metrics.totalWeight}: {totalWeight}%
                </div>
             </div>

             <div className="space-y-4">
                 {metrics.map((m) => (
                     <div key={m.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex gap-4 items-start">
                         <div className="flex-1 grid grid-cols-12 gap-4">
                             <div className="col-span-3">
                                 <label className="text-xs text-slate-500 block mb-1">{t.metrics.name}</label>
                                 <input 
                                    className="w-full px-3 py-2 border rounded-md text-sm"
                                    value={m.name}
                                    onChange={(e) => updateMetric(m.id, 'name', e.target.value)}
                                 />
                             </div>
                             <div className="col-span-7">
                                 <label className="text-xs text-slate-500 block mb-1">{t.metrics.desc}</label>
                                 <input 
                                    className="w-full px-3 py-2 border rounded-md text-sm"
                                    value={m.description}
                                    onChange={(e) => updateMetric(m.id, 'description', e.target.value)}
                                 />
                             </div>
                             <div className="col-span-2">
                                 <label className="text-xs text-slate-500 block mb-1">{t.metrics.weight}</label>
                                 <input 
                                    type="number"
                                    className="w-full px-3 py-2 border rounded-md text-sm"
                                    value={m.weight}
                                    onChange={(e) => updateMetric(m.id, 'weight', parseInt(e.target.value) || 0)}
                                 />
                             </div>
                         </div>
                         <button onClick={() => removeMetric(m.id)} className="mt-6 text-slate-400 hover:text-red-500">
                             <Trash2 size={18} />
                         </button>
                     </div>
                 ))}
             </div>

             <button onClick={addMetric} className="mt-6 w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-500 hover:text-blue-500 transition flex justify-center items-center gap-2">
                 <Plus size={20} /> {t.metrics.addMetric}
             </button>
        </div>
      );
  };

  const renderDashboard = () => {
      const completed = candidates.filter(c => c.status === 'completed');
      const sorted = [...completed].sort((a, b) => (b.analysis?.totalScore || 0) - (a.analysis?.totalScore || 0));

      return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800">{t.dashboard.title}</h2>
                <div className="flex gap-3 items-center">
                    {/* Progress Indicator */}
                    {isProcessing && (
                         <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm mr-2">
                             <Loader2 className="animate-spin text-indigo-600" size={16}/>
                             <div className="flex flex-col w-32">
                                 <div className="flex justify-between text-xs text-slate-500 mb-1">
                                     <span>{t.dashboard.progress}</span>
                                     <span>{analysisProgress.current}/{analysisProgress.total}</span>
                                 </div>
                                 <div className="w-full bg-slate-100 rounded-full h-1.5">
                                     <div 
                                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                                     ></div>
                                 </div>
                             </div>
                         </div>
                    )}

                    <button 
                        onClick={handleStartAnalysis}
                        disabled={isProcessing}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? t.dashboard.analyzing : <><Play size={18} /> {t.dashboard.startAnalysis}</>}
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            {sorted.length > 0 && (
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-500 mb-4">{t.dashboard.charts.dist}</h4>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sorted.map(c => ({ name: c.name, score: c.analysis?.totalScore }))}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis domain={[0, 100]} />
                                    <RechartsTooltip />
                                    <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
                        <h4 className="text-blue-100 font-medium mb-1">{t.dashboard.charts.top}</h4>
                        <div className="text-3xl font-bold mb-2">{sorted[0].name}</div>
                        <div className="text-5xl font-extrabold mb-4">{sorted[0].analysis?.totalScore}</div>
                        <div className="text-blue-100 text-sm">{sorted[0].analysis?.summary.substring(0, 100)}...</div>
                    </div>
                 </div>
            )}

            {/* List */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                 <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                     <div className="col-span-1">{t.dashboard.columns.rank}</div>
                     <div className="col-span-3">{t.dashboard.columns.candidate}</div>
                     <div className="col-span-2">{t.dashboard.columns.score}</div>
                     <div className="col-span-4">{t.dashboard.columns.summary}</div>
                     <div className="col-span-2 text-right">{t.dashboard.columns.actions}</div>
                 </div>
                 <div className="overflow-y-auto flex-1">
                     {sorted.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400">
                             <BarChart2 size={48} className="mb-4 opacity-50"/>
                             <p>{t.dashboard.noData}</p>
                         </div>
                     ) : (
                         sorted.map((c, idx) => (
                             <div key={c.id} className="px-6 py-4 border-b border-slate-100 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition">
                                 <div className="col-span-1 font-bold text-slate-400">#{idx + 1}</div>
                                 <div className="col-span-3">
                                     <div className="font-semibold text-slate-800">{c.name}</div>
                                     <div className="text-xs text-slate-500">{c.company} | {c.education}</div>
                                 </div>
                                 <div className="col-span-2">
                                     <span className={`text-lg font-bold ${
                                         (c.analysis?.totalScore || 0) >= 80 ? 'text-green-600' : 
                                         (c.analysis?.totalScore || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                                     }`}>
                                         {c.analysis?.totalScore}
                                     </span>
                                 </div>
                                 <div className="col-span-4 text-xs text-slate-600 line-clamp-2">
                                     {c.analysis?.summary}
                                 </div>
                                 <div className="col-span-2 text-right flex justify-end gap-2">
                                     <button onClick={() => setModalCandidate(c)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-full">
                                         <FileText size={18} />
                                     </button>
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
            </div>
        </div>
      );
  };

  const renderModal = () => {
      if (!modalCandidate) return null;
      const analysis = modalCandidate.analysis;
      if (!analysis) return null;

      // Fix Bug 2 (Enhancement): Add Deep Analysis UI
      return (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
              <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-start sticky top-0 bg-white z-10">
                      <div>
                          <h2 className="text-2xl font-bold text-slate-800">{modalCandidate.name}</h2>
                          <p className="text-slate-500 text-sm">{modalCandidate.company} | {modalCandidate.education}</p>
                      </div>
                      <button onClick={() => setModalCandidate(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                  </div>
                  
                  <div className="p-6 space-y-8">
                      {/* Deep Analysis Button Area */}
                      {!analysis.detailedMetrics && (
                           <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                               <div>
                                   <h4 className="font-bold text-blue-800 flex items-center gap-2">
                                       <Sparkles size={18} /> 
                                       {settings.language === 'zh' ? '深度分析已就绪' : 'Deep Analysis Available'}
                                   </h4>
                                   <p className="text-sm text-blue-600 mt-1">
                                       {settings.language === 'zh' ? '生成详细的评分标准与候选人亮点，丰富报告内容。' : 'Generate detailed scoring criteria and highlights to enrich the report.'}
                                   </p>
                               </div>
                               <button 
                                   onClick={() => handleEnrichAnalysis(modalCandidate)}
                                   disabled={isEnriching}
                                   className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition flex items-center gap-2"
                               >
                                   {isEnriching ? <Loader2 className="animate-spin" size={16}/> : <FileSearch size={16} />}
                                   {settings.language === 'zh' ? '生成深度分析' : 'Generate Detail'}
                               </button>
                           </div>
                      )}

                      {/* Risks Section */}
                      {analysis.risks && analysis.risks.length > 0 && (
                          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
                              <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="text-amber-600" size={20} />
                                  <h3 className="font-bold text-amber-800">{settings.language === 'zh' ? '潜在风险 / 异常提示' : 'Potential Risks / Anomalies'}</h3>
                              </div>
                              <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                                  {analysis.risks.map((risk, idx) => (
                                      <li key={idx}>{risk}</li>
                                  ))}
                              </ul>
                          </div>
                      )}

                      {/* Scores & Detail */}
                      <div className="space-y-4">
                          {metrics.map(m => (
                              <div key={m.id} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                  {/* Header */}
                                  <div className="flex justify-between items-center mb-2">
                                      <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-700">{m.name}</span>
                                          <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-500">{m.weight}%</span>
                                      </div>
                                      <span className="font-bold text-blue-600 text-lg">{analysis.scores[m.id]}<span className="text-sm text-slate-400">/100</span></span>
                                  </div>
                                  
                                  {/* Progress Bar */}
                                  <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
                                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${analysis.scores[m.id]}%` }}></div>
                                  </div>

                                  {/* Detailed Content (If Available) */}
                                  {analysis.detailedMetrics?.[m.id] ? (
                                      <div className="text-sm space-y-2 mt-3 pt-3 border-t border-slate-200">
                                          <div>
                                              <span className="font-semibold text-slate-600 block mb-1">
                                                  {settings.language === 'zh' ? '评分标准:' : 'Criteria:'}
                                              </span>
                                              <p className="text-slate-600 bg-white p-2 rounded border border-slate-100">{analysis.detailedMetrics[m.id].criteria}</p>
                                          </div>
                                          <div>
                                              <span className="font-semibold text-slate-600 block mb-1">
                                                  {settings.language === 'zh' ? '亮点证据:' : 'Highlight:'}
                                              </span>
                                              <p className="text-slate-600 bg-white p-2 rounded border border-slate-100">{analysis.detailedMetrics[m.id].highlight}</p>
                                          </div>
                                      </div>
                                  ) : (
                                      <p className="text-sm text-slate-600">{analysis.reasons[m.id]}</p>
                                  )}
                              </div>
                          ))}
                      </div>

                      {/* Summary */}
                      <div>
                          <h3 className="text-lg font-bold mb-2 text-slate-800">Summary</h3>
                          <div className="bg-slate-50 p-4 rounded-lg text-slate-700 leading-relaxed">
                              {analysis.summary}
                          </div>
                      </div>

                      {/* Interview Questions */}
                      <div>
                          <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold text-slate-800">{t.dashboard.genInterview}</h3>
                             {!modalCandidate.interviewGuide && (
                                 <button 
                                    onClick={() => generateInterview(modalCandidate)}
                                    disabled={interviewLoading}
                                    className="text-blue-600 text-sm hover:underline flex items-center gap-1"
                                 >
                                     {interviewLoading ? 'Generating...' : <><FileQuestion size={16}/> Generate with AI</>}
                                 </button>
                             )}
                          </div>
                          
                          {modalCandidate.interviewGuide ? (
                              <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-100">
                                  <MarkdownRenderer content={modalCandidate.interviewGuide} />
                              </div>
                          ) : (
                              <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">
                                  Click generate to create tailored interview questions.
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                      <button onClick={() => triggerPDFExport(modalCandidate, 'report')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white transition flex items-center gap-2">
                         <Download size={16}/> {t.dashboard.exportReport}
                      </button>
                      {modalCandidate.interviewGuide && (
                          <button onClick={() => triggerPDFExport(modalCandidate, 'guide')} className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition flex items-center gap-2">
                             <Download size={16}/> {t.dashboard.exportGuide}
                          </button>
                      )}
                      <button onClick={() => setModalCandidate(null)} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900">
                          Close
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  // UPDATED: Flattened Render for Better Pagination
  const renderPDFTemplate = () => {
      if (!exportData) return null;
      const { candidate, type } = exportData;
      
      // Common Horizontal Padding Class (used on inner blocks instead of container to allow splitting)
      const pxClass = "px-12"; 
      
      return (
          <div className="absolute top-0 left-[-9999px] z-[-1] bg-white w-[210mm] text-slate-900" ref={pdfExportRef} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              
              {/* 1. Header Block */}
              <div className={`${pxClass} pt-12 pb-6`}>
                  <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-end">
                      <div>
                          <h1 className="text-2xl font-bold text-slate-800">{type === 'report' ? t.dashboard.exportReport : t.dashboard.exportGuide}</h1>
                          <p className="text-sm text-slate-500">AIHR Studio Assessment</p>
                      </div>
                      <div className="text-right">
                          <div className="text-xl font-bold">{candidate.name}</div>
                          <div className="text-sm text-slate-500">{candidate.company}</div>
                      </div>
                  </div>
              </div>

              {/* 2. Info Block */}
              <div className={`${pxClass} mb-8`}>
                   <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-lg border border-slate-100">
                      <div><span className="text-slate-500 text-sm block">Job Position</span><span className="font-semibold">{jobConfig.title}</span></div>
                      <div><span className="text-slate-500 text-sm block">Total Score</span><span className="font-bold text-xl text-indigo-600">{candidate.analysis?.totalScore || 0}</span></div>
                      <div><span className="text-slate-500 text-sm block">Age / Education</span><span className="font-semibold">{candidate.age || '-'} / {candidate.education || '-'}</span></div>
                      <div><span className="text-slate-500 text-sm block">Date</span><span className="font-semibold">{new Date().toLocaleDateString()}</span></div>
                   </div>
              </div>

              {/* REORDERED: Summary moved BEFORE Risks as requested */}
              {type === 'report' && candidate.analysis && (
                  <>
                      {/* Summary */}
                      <div className={`${pxClass} mt-4 mb-4`}>
                          <h3 className="font-bold text-lg border-l-4 border-blue-500 pl-3">Executive Summary</h3>
                      </div>
                      <div className={`${pxClass} mb-8`}>
                          <div className="bg-white p-0 text-slate-700 leading-relaxed text-sm text-justify">
                              {candidate.analysis.summary}
                          </div>
                      </div>
                  </>
              )}

              {/* 3. Risks */}
              {candidate.analysis?.risks && candidate.analysis.risks.length > 0 && (
                  <>
                      <div className={`${pxClass} mb-2 mt-4`}>
                           <h3 className="font-bold text-red-700 flex items-center gap-2 border-b border-red-200 pb-2">
                              {settings.language === 'zh' ? '⚠️ 潜在风险 / 关注点' : '⚠️ Potential Risks / Key Concerns'}
                           </h3>
                      </div>
                      {candidate.analysis.risks.map((risk, idx) => (
                           <div key={`risk-${idx}`} className={`${pxClass} mb-1.5`}>
                               <div className="flex gap-2 text-sm text-red-800">
                                   <span className="shrink-0">•</span>
                                   <span>{risk}</span>
                               </div>
                           </div>
                      ))}
                      <div className={`${pxClass} mb-8`} /> {/* Spacer */}
                  </>
              )}

              {type === 'report' && candidate.analysis && (
                  <>
                      {/* Metrics - Header */}
                      <div className={`${pxClass} mt-6 mb-2`}>
                          <h3 className="font-bold text-lg text-slate-800 border-l-4 border-indigo-500 pl-3">Evaluation Metrics</h3>
                      </div>
                      
                      {!candidate.analysis.detailedMetrics && (
                          <div className={`${pxClass}`}>
                              <div className="bg-slate-100 p-3 grid grid-cols-12 gap-4 font-semibold text-sm border-t border-l border-r border-slate-200 rounded-t-lg">
                                    <div className="col-span-3">Metric</div>
                                    <div className="col-span-2">Score/Weight</div>
                                    <div className="col-span-7">Assessment</div>
                              </div>
                          </div>
                      )}

                      {/* Metrics - Rows (Individual Blocks for Pagination) */}
                      {metrics.map((m, i) => (
                          <div key={m.id} className={`${pxClass}`}>
                              {candidate.analysis?.detailedMetrics?.[m.id] ? (
                                  // RICH VERSION
                                  <div className={`p-4 mb-4 rounded-lg border border-slate-200 bg-slate-50 text-sm break-inside-avoid`}>
                                      <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2">
                                          <div className="font-bold text-slate-800 text-base">{m.name}</div>
                                          <div className="flex items-center gap-3">
                                              <span className="text-slate-500">Weight: {m.weight}%</span>
                                              <span className="font-bold text-indigo-600 text-lg">{candidate.analysis!.scores[m.id]}</span>
                                          </div>
                                      </div>
                                      
                                      <div className="space-y-3">
                                          <div>
                                              <span className="block font-semibold text-slate-700 mb-1 opacity-75">{settings.language === 'zh' ? '评分标准 / Rule:' : 'Criteria:'}</span>
                                              <div className="text-slate-600 leading-relaxed text-justify bg-white p-2 rounded border border-slate-100">
                                                  {candidate.analysis!.detailedMetrics![m.id].criteria}
                                              </div>
                                          </div>
                                          <div>
                                              <span className="block font-semibold text-slate-700 mb-1 opacity-75">{settings.language === 'zh' ? '亮点证据 / Highlight:' : 'Highlights:'}</span>
                                              <div className="text-slate-600 leading-relaxed text-justify bg-white p-2 rounded border border-slate-100">
                                                  {candidate.analysis!.detailedMetrics![m.id].highlight}
                                              </div>
                                          </div>
                                          <div>
                                              <span className="block font-semibold text-slate-700 mb-1 opacity-75">{settings.language === 'zh' ? '简评:' : 'Brief:'}</span>
                                              <div className="text-slate-500 italic">
                                                  {candidate.analysis!.reasons[m.id]}
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              ) : (
                                  // COMPACT VERSION
                                  <div className={`p-3 grid grid-cols-12 gap-4 text-sm border-l border-r border-b border-slate-100 items-start ${i === metrics.length - 1 && !candidate.analysis?.detailedMetrics ? 'rounded-b-lg border-b-slate-200' : ''}`}>
                                        <div className="col-span-3 font-medium text-slate-700">{m.name}</div>
                                        <div className="col-span-2">
                                            <div className="font-bold text-indigo-600">{candidate.analysis!.scores[m.id]}</div>
                                            <div className="text-xs text-slate-400">{m.weight}%</div>
                                        </div>
                                        <div className="col-span-7 text-slate-600 leading-relaxed text-justify">{candidate.analysis!.reasons[m.id]}</div>
                                  </div>
                              )}
                          </div>
                      ))}
                  </>
              )}

              {type === 'guide' && candidate.interviewGuide && (
                  <> 
                       {/* Flatten Markdown Lines */}
                       {candidate.interviewGuide.split('\n').map((line, i) => (
                           <div key={i} className={`${pxClass}`}>
                               <MarkdownLineRenderer line={line} />
                           </div>
                       ))}
                       <div className="h-12"></div> {/* Bottom spacer */}
                  </>
              )}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {renderSidebar()}
      <main className="flex-1 ml-64 p-8">
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'job' && renderJobConfig()}
        {activeTab === 'resume' && (
            <ResumeImportView 
                t={t} 
                candidates={candidates} 
                setCandidates={setCandidates} 
                onAddCandidate={handleAddCandidate}
            />
        )}
        {activeTab === 'metrics' && renderMetrics()}
        {activeTab === 'dashboard' && renderDashboard()}
      </main>
      {renderModal()}
      {renderHelpModal()}
      {renderPDFTemplate()}
    </div>
  );
}

// Simple Nav Component
const NavItem = ({ id, icon, label, active, set }: any) => (
  <button 
    onClick={() => set(id)}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium text-sm">{label}</span>
  </button>
);