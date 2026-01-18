import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Gemini 클라이언트 초기화
let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

// 문서 분석 결과 타입
export interface DocumentAnalysis {
  companyName: string;
  contentSummary: string;
  suggestedFilename: string;
  confidence: number;
}

// OCR 텍스트를 분석하여 업체명과 내용 요약 추출
export async function analyzeDocument(ocrText: string): Promise<DocumentAnalysis> {
  const client = getGeminiClient();
  
  // Gemini 2.5 Flash 모델 사용 (무료 티어 최상위)
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });
  
  const prompt = `당신은 문서 분석 전문가입니다. 아래 OCR로 추출된 텍스트를 분석하여 다음 정보를 JSON 형식으로 반환해주세요.

분석 규칙:
1. 업체명(companyName): 문서에서 발신자/작성자 회사명을 찾아주세요. 없으면 수신자 회사명을 사용하세요.
2. 내용요약(contentSummary): 문서의 핵심 내용을 간결하게 5~15자 이내로 요약해주세요. (예: 견적서, 계약서, 발주서, 세금계산서, 거래명세서 등)
3. 신뢰도(confidence): 분석 결과에 대한 신뢰도를 0~100 사이의 숫자로 표시해주세요.

중요 사항:
- 업체명은 (주), 주식회사 등의 법인 표기를 제거하고 순수 회사명만 사용
- 영어 회사명은 한글로 번역하지 말고 그대로 사용
- 내용요약은 짧고 명확하게 (파일명에 사용됨)
- 날짜, 문서번호는 포함하지 않음
- 분석이 어려운 경우에도 최선의 추측을 제공

응답은 반드시 아래 JSON 형식으로만 해주세요:
{
  "companyName": "회사명",
  "contentSummary": "내용요약",
  "confidence": 85
}

---
OCR 텍스트:
${ocrText.substring(0, 8000)}
---`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON 응답을 파싱할 수 없습니다.');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // 파일명 생성 (업체명_내용요약)
    const companyName = sanitizeFilename(parsed.companyName || '알수없음');
    const contentSummary = sanitizeFilename(parsed.contentSummary || '문서');
    const maxLength = parseInt(process.env.MAX_FILENAME_LENGTH || '50');
    
    let suggestedFilename = `${companyName}_${contentSummary}`;
    if (suggestedFilename.length > maxLength) {
      suggestedFilename = suggestedFilename.substring(0, maxLength);
    }
    
    return {
      companyName: parsed.companyName || '알수없음',
      contentSummary: parsed.contentSummary || '문서',
      suggestedFilename,
      confidence: parsed.confidence || 0,
    };
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(`문서 분석 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 파일명에 사용할 수 없는 문자 제거
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '') // Windows 금지 문자
    .replace(/\s+/g, '_') // 공백을 언더스코어로
    .replace(/_{2,}/g, '_') // 연속 언더스코어 제거
    .replace(/^_|_$/g, '') // 앞뒤 언더스코어 제거
    .trim();
}

// 중복 파일명 처리
export function generateUniqueFilename(baseName: string, existingNames: string[]): string {
  const ext = '.pdf';
  let filename = `${baseName}${ext}`;
  let counter = 1;
  
  while (existingNames.includes(filename)) {
    filename = `${baseName}_${counter}${ext}`;
    counter++;
  }
  
  return filename;
}
