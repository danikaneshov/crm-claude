// ==========================================
// Telegram Photo Storage
// ==========================================
// Upload photos to a private Telegram channel and retrieve them.

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const TELEGRAM_FILE_BASE = 'https://api.telegram.org/file/bot';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return token;
}

function getStorageChatId(): string {
  const chatId = process.env.TELEGRAM_STORAGE_CHAT_ID;
  if (!chatId) throw new Error('TELEGRAM_STORAGE_CHAT_ID not set');
  return chatId;
}

export interface TelegramPhotoResult {
  chat_id: number;
  message_id: number;
  file_id: string;
  file_unique_id: string;
}

/**
 * Upload a photo to the Telegram storage channel.
 *
 * @param photoBuffer - Image data as Buffer
 * @param caption - Optional caption for the photo
 * @returns Telegram photo metadata (message_id, file_id, etc.)
 */
export async function uploadPhotoToChannel(
  photoBuffer: Buffer,
  caption?: string
): Promise<TelegramPhotoResult> {
  const token = getBotToken();
  const chatId = getStorageChatId();

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', new Blob([photoBuffer]), 'report.jpg');
  if (caption) {
    formData.append('caption', caption);
  }

  const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendPhoto`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram sendPhoto failed: ${error}`);
  }

  const data = await response.json();

  if (!data.ok || !data.result) {
    throw new Error(`Telegram sendPhoto error: ${JSON.stringify(data)}`);
  }

  // Get the largest photo size (last in array)
  const photos = data.result.photo;
  const largestPhoto = photos[photos.length - 1];

  return {
    chat_id: data.result.chat.id,
    message_id: data.result.message_id,
    file_id: largestPhoto.file_id,
    file_unique_id: largestPhoto.file_unique_id,
  };
}

/**
 * Download a photo from Telegram by file_id.
 *
 * @param fileId - Telegram file_id
 * @returns Photo as Buffer
 */
export async function downloadPhotoFromTelegram(fileId: string): Promise<Buffer> {
  const token = getBotToken();

  // Step 1: Get file path
  const fileResponse = await fetch(`${TELEGRAM_API_BASE}${token}/getFile?file_id=${fileId}`);

  if (!fileResponse.ok) {
    throw new Error(`Telegram getFile failed: ${await fileResponse.text()}`);
  }

  const fileData = await fileResponse.json();

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error(`Telegram getFile error: ${JSON.stringify(fileData)}`);
  }

  // Step 2: Download file
  const downloadResponse = await fetch(
    `${TELEGRAM_FILE_BASE}${token}/${fileData.result.file_path}`
  );

  if (!downloadResponse.ok) {
    throw new Error(`Telegram file download failed: ${downloadResponse.statusText}`);
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
