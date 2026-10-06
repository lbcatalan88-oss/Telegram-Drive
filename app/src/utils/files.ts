const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi', 'm4v'] as const;
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'opus', 'ogg'] as const;
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'] as const;

const LEGACY_TD_METADATA = /\s+(?:ORIGEN|ORIGIN|TIPO_VISUAL|VISUAL_TYPE|SOFTWARE_ORIGEN|SOFTWARE_ORIGIN|DIMENSIONES|DIMENSIONS|RESOLUCION|RESOLUTION|DURACION|DURATION|FECHA_ORIGEN|ORIGINAL_DATE|DISPOSITIVO|DEVICE|MODELO|MODEL|ANCHO|WIDTH|ALTO|HEIGHT|HASH|SHA256|MD5|TAGS|FUENTE|SOURCE|RUTA_ORIGEN|ORIGINAL_PATH|MIME|MIME_TYPE)\s*:/i;

export function stripLegacyTdMetadata(name: string): string {
  const value = String(name || '').trim();
  const marker = value.search(LEGACY_TD_METADATA);
  return marker > 0 && value.slice(0, marker).includes('.')
    ? value.slice(0, marker).trim()
    : value;
}

export function getFileExtension(name: string): string {
  const logicalName = stripLegacyTdMetadata(name).replace(/\\/g, '/');
  const baseName = logicalName.split('/').pop() || logicalName;
  const dot = baseName.lastIndexOf('.');
  if (dot <= 0 || dot === baseName.length - 1) return '';
  const extension = baseName.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,12}$/.test(extension) ? extension : '';
}

const hasExtension = (name: string, extensions: readonly string[]): boolean =>
  extensions.includes(getFileExtension(name) as never);

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const base = 1024;
  const precision = decimals < 0 ? 0 : decimals;
  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
  return parseFloat((bytes / Math.pow(base, unitIndex)).toFixed(precision)) + " " + units[unitIndex];
}

const hasMimePrefix = (mimeType: string | null | undefined, prefix: string): boolean =>
  typeof mimeType === 'string' && mimeType.trim().toLowerCase().startsWith(prefix);

export const isVideoFile = (name: string, mimeType?: string | null): boolean =>
  hasMimePrefix(mimeType, 'video/') || hasExtension(name, VIDEO_EXTENSIONS);
export const isAudioFile = (name: string, mimeType?: string | null): boolean =>
  hasMimePrefix(mimeType, 'audio/') || hasExtension(name, AUDIO_EXTENSIONS);
export const isMediaFile = (name: string, mimeType?: string | null): boolean =>
  isVideoFile(name, mimeType) || isAudioFile(name, mimeType);
export const isImageFile = (name: string, mimeType?: string | null): boolean =>
  hasMimePrefix(mimeType, 'image/') || hasExtension(name, IMAGE_EXTENSIONS);
export const isPdfFile = (name: string, mimeType?: string | null): boolean =>
  mimeType?.trim().toLowerCase() === 'application/pdf' || getFileExtension(name) === 'pdf';
export const isZipFile = (name: string): boolean => getFileExtension(name) === 'zip';
export const isRarFile = (name: string): boolean => getFileExtension(name) === 'rar';
export const isSevenZFile = (name: string): boolean => getFileExtension(name) === '7z';
export const isArchiveFile = (name: string): boolean => isZipFile(name) || isRarFile(name) || isSevenZFile(name);

export function sanitizeFilename(name: string): string {
  return stripLegacyTdMetadata(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    || 'file';
}
