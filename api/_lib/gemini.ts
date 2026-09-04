// ==========================================
// Gemini AI Service
// ==========================================
// Uses Google Generative AI SDK to analyze r_keeper report photos.

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RKeeperMapping, AIResult } from '@crm/shared';

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Build the Gemini prompt using location-specific r_keeper position names.
 * Each location can have different names for hookah and replacement positions.
 */
function buildPrompt(mapping: RKeeperMapping): string {
  return `Ты анализируешь фотографию электронного отчёта из системы r_keeper.

Найди в отчёте следующие позиции:
- "${mapping.hookah_name}" — это кальян (hookah)
- "${mapping.replacement_name}" — это замена (replacement)

Верни результат строго в формате JSON:
{
  "hookahs": <количество>,
  "replacements": <количество>
}

Правила:
- Если позиция отсутствует в отчёте, укажи 0
- Ищи именно количество (шт), а не сумму в тенге
- Не добавляй никаких пояснений, только JSON
- Если не можешь определить значения, верни: {"hookahs": null, "replacements": null}`;
}

/**
 * Analyze an r_keeper report photo using Gemini Vision.
 *
 * @param photoBuffer - Image data as Buffer
 * @param rkeeperMapping - Location-specific r_keeper position names
 * @returns Parsed AI result with hookahs and replacements count
 */
export async function analyzeReport(
  photoBuffer: Buffer,
  rkeeperMapping: RKeeperMapping
): Promise<AIResult> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = buildPrompt(rkeeperMapping);

  // Convert Buffer to base64 for Gemini
  const base64Image = photoBuffer.toString('base64');

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text.trim();
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);

    return {
      hookahs: parsed.hookahs !== undefined ? parsed.hookahs : null,
      replacements: parsed.replacements !== undefined ? parsed.replacements : null,
      confidence: parsed.confidence,
    };
  } catch {
    console.error('Failed to parse Gemini response:', text);
    return {
      hookahs: null,
      replacements: null,
    };
  }
}
