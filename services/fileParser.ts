import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Fix for PDF.js import: handle both module namespace and default export
// In many ESM environments (like esm.sh), the library is on the 'default' property.
const pdfjs: any = (pdfjsLib as any).default?.GlobalWorkerOptions 
    ? (pdfjsLib as any).default 
    : pdfjsLib;

// Configure PDF.js worker
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} else {
    console.error('PDF.js GlobalWorkerOptions not found in import:', pdfjsLib);
}

// Fix for XLSX import
const XlsxEngine = (XLSX as any).default || XLSX;

export interface ParsedFile {
    name: string;
    text: string;
}

export async function parseFile(file: File): Promise<ParsedFile> {
    const fileName = file.name;
    // Remove extension for the candidate name
    const name = fileName.replace(/\.[^/.]+$/, "");
    
    let text = "";
    const extension = fileName.split('.').pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    try {
        switch (extension) {
            case 'pdf':
                text = await parsePDF(arrayBuffer);
                break;
            case 'docx':
            case 'doc':
                text = await parseDocx(arrayBuffer);
                break;
            case 'xlsx':
            case 'xls':
                text = parseExcel(arrayBuffer);
                break;
            case 'txt':
            case 'md':
                text = new TextDecoder().decode(arrayBuffer);
                break;
            default:
                // Attempt to read as plain text for unknown types, or throw
                try {
                     text = new TextDecoder().decode(arrayBuffer);
                } catch {
                     throw new Error(`Unsupported file type: .${extension}`);
                }
                break;
        }
    } catch (error) {
        console.error(`Error parsing file ${fileName}:`, error);
        throw new Error(`Failed to parse ${fileName}: ${(error as Error).message}`);
    }

    if (!text || text.trim().length === 0) {
        throw new Error(`No text content found in ${fileName}. Please check if the file is a scanned image.`);
    }

    return { name, text };
}

async function parsePDF(buffer: ArrayBuffer): Promise<string> {
    try {
        // Use the resolved pdfjs object
        const loadingTask = pdfjs.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n\n';
        }
        return fullText;
    } catch (e: any) {
        // Enhance error message for common worker failures
        if (e.name === 'MissingPDFException') {
            throw new Error("Invalid or corrupted PDF file.");
        }
        if (e.message && e.message.includes('fake worker')) {
            throw new Error("PDF parser initialization failed (Worker Error). Please refresh and try again.");
        }
        throw e;
    }
}

async function parseDocx(buffer: ArrayBuffer): Promise<string> {
    // Mammoth is designed for .docx. It does not support legacy binary .doc files well.
    try {
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        return result.value;
    } catch (e) {
        throw new Error("Could not parse DOCX. Ensure it is a valid .docx file (not .doc).");
    }
}

function parseExcel(buffer: ArrayBuffer): string {
    const workbook = XlsxEngine.read(buffer, { type: 'array' });
    let fullText = '';
    
    // Read all sheets
    if (workbook.SheetNames && Array.isArray(workbook.SheetNames)) {
        workbook.SheetNames.forEach((sheetName: string) => {
            const sheet = workbook.Sheets[sheetName];
            const sheetText = XlsxEngine.utils.sheet_to_txt(sheet);
            fullText += `--- Sheet: ${sheetName} ---\n${sheetText}\n`;
        });
    }
    return fullText;
}