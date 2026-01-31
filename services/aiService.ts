import { GoogleGenAI, Type } from '@google/genai';
import { AppSettings, Candidate, JobConfig, Metric, ModelProvider } from '../types';

interface AIResponseSchema {
  scores: { metricId: string; score: number }[];
  reasons: { metricId: string; reason: string }[];
  summary: string;
  risks: string[];
  candidateInfo: {
    name: string;
    age: string;
    education: string;
    company: string;
    phone: string;
  };
}

// --- Utility: Retry Logic ---
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`AI Attempt ${i + 1} failed:`, error);
      // Exponential backoff
      await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
    }
  }
  throw lastError;
}

// Helper to strictly extract JSON from a potentially messy string
function extractJSON(str: string): string {
    // Remove "thinking" blocks often returned by DeepSeek-R1 (e.g. <think>...</think>)
    const cleanStr = str.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    const firstOpen = cleanStr.indexOf('{');
    const lastClose = cleanStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        return cleanStr.substring(firstOpen, lastClose + 1);
    }
    return cleanStr; // Return original (cleaned) if extraction fails, let JSON.parse fail normally
}

export const generateInterviewQuestions = async (
  candidate: Candidate,
  job: JobConfig,
  settings: AppSettings,
  currentDate: string
): Promise<string> => {
  
  // Incorporate identified risks into the context if available
  const riskContext = candidate.analysis?.risks && candidate.analysis.risks.length > 0
    ? `Identified Risks/Anomalies in Resume: \n${candidate.analysis.risks.map(r => `- ${r}`).join('\n')}`
    : "No obvious risks detected by initial analysis.";

  const targetLang = settings.language === 'zh' ? 'Simplified Chinese (简体中文)' : 'English';

  const prompt = `
    Role: Expert HR Interviewer & Fraud Detector.
    Task: Generate a structured interview guide for a candidate.
    Language: ${targetLang}.
    Current Date: ${currentDate}.
    
    Job Title: ${job.title}
    Job Description:
    ${job.description}
    
    Candidate Resume Content:
    ${candidate.rawText}
    
    ${riskContext}

    Please generate 7-10 interview questions divided into these 3 STRICT categories:

    1. **Competency Validation (JD Match)**: 
       Questions to verify if they truly possess the skills required by the JD. Focus on specific projects or technical details.

    2. **Authenticity & Risk Verification**: 
       Based on the "Identified Risks" above or your own analysis of the resume text. 
       - probe employment gaps (calculate using Current Date)
       - verify short tenures
       - challenge vague project descriptions
       - check for exaggerated titles/roles
       - validate consistency of dates.

    3. **Information Gap Filling**:
       Ask about missing critical information (e.g., reasons for leaving, specific tools not mentioned, degree completion, etc.).

    Format Requirement:
    ### 1. Competency Validation
    Q1: [Question]
    *Rationale/Guide: [What to look for in the answer]*
    ...

    ### 2. Authenticity Verification
    Q...
    *Rationale/Guide: [Why this is a red flag]*
    ...

    ### 3. Gap Filling
    Q...
  `;

  if (settings.provider === ModelProvider.Gemini) {
    return await callGeminiText(prompt, settings);
  } else {
    return await callDeepSeekText(prompt, settings);
  }
};

// NEW: Enrich Analysis Function
export const enrichAnalysis = async (
  candidate: Candidate,
  job: JobConfig,
  metrics: Metric[],
  settings: AppSettings
): Promise<Record<string, { criteria: string, highlight: string }>> => {
  
  const existingScores = JSON.stringify(candidate.analysis?.scores || {});
  const metricsDesc = metrics.map(m => `- ID: ${m.id}, Name: ${m.name}, Desc: ${m.description}`).join('\n');
  
  const targetLangInstruction = settings.language === 'zh' 
    ? "Simplified Chinese (简体中文)"
    : "English";

  const systemPrompt = `
    You are an expert HR Analyst. 
    You have already scored a candidate. Now, you must provide a DETAILED breakdown of WHY those scores were given.
    
    Task: For each metric, provide:
    1. "criteria": The specific evaluation standard or calculation rule derived from the Job Description that explains this score level.
    2. "highlight": Specific evidence, keywords, or project details from the resume that matches (or fails) this criteria.

    Language: ${targetLangInstruction}.
    Output: RAW JSON ONLY.
    
    Structure:
    {
       "metricId_1": { "criteria": "...", "highlight": "..." },
       "metricId_2": { "criteria": "...", "highlight": "..." },
       ...
    }
  `;

  const userPrompt = `
    Job Description: ${job.description}
    Resume: ${candidate.rawText}
    
    Metrics:
    ${metricsDesc}
    
    EXISTING SCORES (Do not change these, justify them):
    ${existingScores}
  `;

  try {
    let jsonStr = '';
    if (settings.provider === ModelProvider.Gemini) {
        // Reuse JSON call but strict text prompt if schema is complex, or use loose mode
        jsonStr = await callGeminiJSON(systemPrompt, userPrompt, settings);
    } else {
        jsonStr = await callDeepSeekJSON(systemPrompt, userPrompt, settings);
    }
    
    jsonStr = extractJSON(jsonStr);
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (error) {
    console.error("Enrichment Failed", error);
    throw error;
  }
};

export const analyzeResume = async (
  candidate: Candidate,
  job: JobConfig,
  metrics: Metric[],
  settings: AppSettings,
  currentDate: string
): Promise<any> => {
  // Construct the prompt with JSON schema requirement
  const metricsDesc = metrics.map(m => `- ID: ${m.id}, Name: ${m.name}, Criteria: ${m.description}, Weight: ${m.weight}%`).join('\n');
  
  const targetLangInstruction = settings.language === 'zh' 
    ? "Simplified Chinese (简体中文). Even if the resume or JD is in English, you MUST write the summary, reasons, and risks in Chinese."
    : "English. Even if the resume is in Chinese, you MUST write the summary, reasons, and risks in English.";

  const systemPrompt = `
    You are an expert HR AI Assistant with a focus on risk control. Your task is to evaluate a resume against a job description based on specific weighted metrics AND detect potential risks.
    
    CRITICAL INSTRUCTION: 
    1. Output RAW JSON ONLY. Do not output markdown blocks.
    2. LANGUAGE: The 'summary', 'reasons', and 'risks' fields MUST be written in ${targetLangInstruction}.
    3. Start directly with '{' and end with '}'.
    
    Required JSON Structure:
    {
      "scores": [
        { "metricId": "string (matching input IDs)", "score": number (0-100) }
      ],
      "reasons": [
        { "metricId": "string (matching input IDs)", "reason": "string (brief justification in target language)" }
      ],
      "summary": "string (overall assessment, under 150 words, in target language)",
      "risks": [
        "string (List specific anomalies in target language: e.g., 'Employment gap in 2022', 'Vague project details', 'Short tenure at Company X', 'Mismatch between degree and age', 'Missing contact info')"
      ],
      "candidateInfo": {
        "name": "string (The candidate's REAL name. CLEAN IT. Remove titles like 'Manager', brackets like '【】' or '()', job roles, and numbers. For Chinese names, it is usually 2-4 characters)",
        "age": "string (extract or N/A)",
        "education": "string (highest degree/school)",
        "company": "string (most recent company)",
        "phone": "string (contact info)"
      }
    }
  `;

  const userPrompt = `
    Current Date: ${currentDate} (Use this to calculate age, tenure, and gaps).
    
    Job Title: ${job.title}
    Job Description: ${job.description}
    
    Metrics to Evaluate:
    ${metricsDesc}
    
    Candidate Resume Content:
    ${candidate.rawText}
  `;

  try {
    let jsonStr = '';
    if (settings.provider === ModelProvider.Gemini) {
        jsonStr = await callGeminiJSON(systemPrompt, userPrompt, settings);
    } else {
        jsonStr = await callDeepSeekJSON(systemPrompt, userPrompt, settings);
    }
    
    // Strict Extraction
    jsonStr = extractJSON(jsonStr);
    
    // Defensive parsing
    let parsed: any = {};
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        console.error("JSON Parse Error on string:", jsonStr);
        throw new Error("AI returned invalid JSON structure.");
    }

    // Ensure required properties exist to prevent 'forEach' undefined errors
    return {
        scores: Array.isArray(parsed.scores) ? parsed.scores : [],
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
        summary: parsed.summary || "Analysis incomplete.",
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        candidateInfo: parsed.candidateInfo || {}
    };

  } catch (error) {
    console.error("AI Analysis Failed", error);
    throw error;
  }
};

// --- Gemini Implementation ---

async function callGeminiText(prompt: string, settings: AppSettings): Promise<string> {
  if (!settings.geminiKey) throw new Error("Gemini API Key missing");
  
  // Explicitly new instance for each call
  const ai = new GoogleGenAI({ apiKey: settings.geminiKey });
  const modelName = settings.selectedModel || 'gemini-3-flash-preview';
  
  return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.1, // Low temp for deterministic results
        }
      });
      return response.text || "No response generated.";
  });
}

async function callGeminiJSON(systemPrompt: string, userPrompt: string, settings: AppSettings): Promise<string> {
  if (!settings.geminiKey) throw new Error("Gemini API Key missing");
  
  // Explicitly new instance for each call
  const ai = new GoogleGenAI({ apiKey: settings.geminiKey });
  const modelName = settings.selectedModel || 'gemini-3-flash-preview';

  // Strategy 1: Attempt with valid JSON Schema
  try {
      return await withRetry(async () => {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.1, // Low temp for deterministic results
              responseMimeType: "application/json",
              // Note: For 'enrich' calls we rely on system prompt instructions primarily 
              // as schema definition can be verbose for variable keys. 
              // But we can leave responseSchema undefined here if it's too dynamic, 
              // however, to reuse this function we assume loose JSON mode if schema is strict.
            }
          });
          return response.text || "{}";
      }, 2, 1000); 
  } catch (e) {
      console.warn("Gemini JSON Schema mode failed, falling back to loose JSON mode...", e);
      
      // Strategy 2: Fallback to plain text JSON instruction
      return await withRetry(async () => {
           const response = await ai.models.generateContent({
             model: modelName,
             contents: `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: Return valid JSON only.`,
             config: {
                 temperature: 0.1 // Low temp
             }
           });
           return response.text || "{}";
      }, 2, 1000);
  }
}

// --- DeepSeek (via SiliconFlow) Implementation ---

function getValidSiliconFlowModel(selectedModel: string): string {
    // UPDATED: Allow any user input, but default to V3.2 if empty
    if (!selectedModel || selectedModel.trim() === '') {
        return 'deepseek-ai/DeepSeek-V3.2';
    }
    return selectedModel;
}

async function callDeepSeekText(prompt: string, settings: AppSettings): Promise<string> {
   if (!settings.deepSeekKey) throw new Error("SiliconFlow API Key missing");
   
   const baseUrl = settings.deepSeekBaseUrl || 'https://api.siliconflow.cn/v1';
   const modelName = getValidSiliconFlowModel(settings.selectedModel);

   return await withRetry(async () => {
       const response = await fetch(`${baseUrl}/chat/completions`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${settings.deepSeekKey}`
         },
         body: JSON.stringify({
           model: modelName,
           temperature: 0.1, // Low temp for consistency
           messages: [
             { role: 'user', content: prompt }
           ],
           stream: false
         })
       });

       if (!response.ok) {
         const err = await response.text();
         throw new Error(`SiliconFlow API Error: ${err}`);
       }

       const data = await response.json();
       return data.choices?.[0]?.message?.content || "";
   });
}

async function callDeepSeekJSON(systemPrompt: string, userPrompt: string, settings: AppSettings): Promise<string> {
    if (!settings.deepSeekKey) throw new Error("SiliconFlow API Key missing");
   
    const baseUrl = settings.deepSeekBaseUrl || 'https://api.siliconflow.cn/v1';
    const modelName = getValidSiliconFlowModel(settings.selectedModel);
    
    // Check for "R1" to determine if we should omit strict JSON mode
    // (SiliconFlow's R1 sometimes struggles with strict json_object enforcement or doesn't support it)
    const isR1 = modelName.includes('R1');

    return await withRetry(async () => {
        const body: any = {
            model: modelName,
            temperature: 0.1, // Low temp for consistency
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            stream: false
        };

        if (!isR1) {
            body.response_format = { type: 'json_object' };
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.deepSeekKey}`
          },
          body: JSON.stringify(body)
        });
     
        if (!response.ok) {
          const err = await response.text();
          throw new Error(`SiliconFlow API Error: ${err}`);
        }
     
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "{}";
    });
}