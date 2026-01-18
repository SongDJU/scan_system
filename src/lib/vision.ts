import { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs';
import path from 'path';

// Google Cloud Vision 클라이언트 초기화
let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (credentialsPath) {
      const absolutePath = path.resolve(process.cwd(), credentialsPath);
      if (fs.existsSync(absolutePath)) {
        visionClient = new ImageAnnotatorClient({
          keyFilename: absolutePath,
        });
      } else {
        console.error('Google credentials file not found:', absolutePath);
        throw new Error('Google credentials file not found');
      }
    } else {
      // 환경변수나 기본 인증 사용
      visionClient = new ImageAnnotatorClient();
    }
  }
  return visionClient;
}

// PDF를 이미지로 변환 후 OCR 수행
export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const client = getVisionClient();
  
  try {
    // PDF 파일 읽기
    const fileBuffer = fs.readFileSync(pdfPath);
    const base64Content = fileBuffer.toString('base64');
    
    // Google Vision API로 PDF OCR 수행
    const request = {
      requests: [
        {
          inputConfig: {
            content: base64Content,
            mimeType: 'application/pdf',
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION' as const,
            },
          ],
          // 최대 5페이지까지만 처리 (비용 절감)
          pages: [1, 2, 3, 4, 5],
        },
      ],
    };
    
    const [result] = await client.batchAnnotateFiles(request);
    
    let fullText = '';
    
    if (result.responses) {
      for (const fileResponse of result.responses) {
        if (fileResponse.responses) {
          for (const pageResponse of fileResponse.responses) {
            if (pageResponse.fullTextAnnotation?.text) {
              fullText += pageResponse.fullTextAnnotation.text + '\n';
            }
          }
        }
      }
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error(`OCR 처리 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 이미지 파일 OCR (PDF가 아닌 경우)
export async function extractTextFromImage(imagePath: string): Promise<string> {
  const client = getVisionClient();
  
  try {
    const [result] = await client.textDetection(imagePath);
    const detections = result.textAnnotations;
    
    if (detections && detections.length > 0) {
      return detections[0].description || '';
    }
    
    return '';
  } catch (error) {
    console.error('Image OCR Error:', error);
    throw new Error(`이미지 OCR 처리 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 파일 타입에 따라 적절한 OCR 수행
export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return extractTextFromPDF(filePath);
  } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
    return extractTextFromImage(filePath);
  } else {
    throw new Error(`지원하지 않는 파일 형식입니다: ${ext}`);
  }
}
