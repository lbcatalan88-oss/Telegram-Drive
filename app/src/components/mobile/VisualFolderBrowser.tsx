import { FolderOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import type { TelegramFile } from '../../types';

export interface VirtualFolderInfo {
  name: string;
  fileCount: number;
  totalBytes: number;
  kinds: string[];
}

export interface VirtualFolderView {
  folders: VirtualFolderInfo[];
  files: TelegramFile[];
}

function cleanStoredPath(name: string) {
  return name
    .replace(/^\s*[📁🗂️]+\s*/u, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .trim();
}

function kindForName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic'].includes(ext)) return 'Fotos';
  if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'].includes(ext)) return 'Videos';
  if (['mp3', 'm4a', 'flac', 'wav', 'ogg', 'aac'].includes(ext)) return 'Audio';
  if (['pdf', 'cbr', 'cbz', 'epub', 'txt', 'doc', 'docx'].includes(ext)) return 'Docs';
  return 'Archivos';
}

function iconForFolder(name: string) {
  const n = name.toLowerCase();
  if (n.includes('lucero')) return '✨';
  if (n.includes('cdf') || n === 'tv' || n.includes('television')) return '📺';
  if (n.includes('foto') || n.includes('imagen')) return '🖼️';
  if (n.includes('video') || n.includes('pelicula') || n.includes('cine')) return '🎬';
  if (n.includes('audio') || n.includes('music') || n.includes('radio')) return '🎵';
  if (n.includes('document') || n.includes('pdf') || n.includes('prensa') || n.includes('revista')) return '📚';
  if (n.includes('anime')) return '⚡';
  if (n.includes('comic')) return '💥';
  if (n.includes('download') || n.includes('descarga')) return '⬇️';
  if (n.includes('cedoc')) return '🗃️';
  return '📁';
}

function formatCompactBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const digits = size >= 100 || unit === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unit]}`;
}

export function getVirtualFolderView(files: TelegramFile[], currentPath: string[]): VirtualFolderView {
  const folderMap = new Map<string, { count: number; bytes: number; kinds: Set<string> }>();
  const visibleFiles: TelegramFile[] = [];

  for (const file of files) {
    const cleaned = cleanStoredPath(file.name);
    const segments = cleaned.split('/').filter(Boolean);
    const baseName = segments.pop() || file.name;
    const folders = segments;

    const matchesCurrent = currentPath.every((part, index) => folders[index] === part);
    if (!matchesCurrent) continue;

    if (folders.length > currentPath.length) {
      const child = folders[currentPath.length];
      const existing = folderMap.get(child) || { count: 0, bytes: 0, kinds: new Set<string>() };
      existing.count += 1;
      existing.bytes += Number(file.size || 0);
      existing.kinds.add(kindForName(baseName));
      folderMap.set(child, existing);
      continue;
    }

    if (folders.length === currentPath.length) {
      visibleFiles.push({ ...file, display_name: baseName });
    }
  }

  const folders = Array.from(folderMap.entries())
    .map(([name, meta]) => ({
      name,
      fileCount: meta.count,
      totalBytes: meta.bytes,
      kinds: Array.from(meta.kinds).slice(0, 3),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const sortedFiles = [...visibleFiles].sort((a, b) =>
    (a.display_name || a.name).localeCompare(b.display_name || b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  return { folders, files: sortedFiles };
}

interface Props {
  currentPath: string[];
  folders: VirtualFolderInfo[];
  onPathChange: (path: string[]) => void;
}

export function VisualFolderBrowser({ currentPath, folders, onPathChange }: Props) {
  return (
    <section className="fmplus-virtual-browser">
      <div className="fmplus-pathbar" aria-label="Ruta actual">
        {currentPath.length > 0 && (
          <button
            type="button"
            className="fmplus-path-back"
            onClick={() => onPathChange(currentPath.slice(0, -1))}
            aria-label="Volver a la carpeta anterior"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
        )}
        <button type="button" className="fmplus-path-home" onClick={() => onPathChange([])}>
          <FolderOpen aria-hidden="true" />
          <span>Biblioteca</span>
        </button>
        {currentPath.map((part, index) => (
          <span className="fmplus-path-part" key={`${part}-${index}`}>
            <ChevronRight aria-hidden="true" />
            <button type="button" onClick={() => onPathChange(currentPath.slice(0, index + 1))}>
              {part}
            </button>
          </span>
        ))}
      </div>

      {folders.length > 0 && (
        <div>
          <div className="fmplus-folder-section-title">
            <div>
              <strong>{currentPath.length ? 'Carpetas' : 'Explorar carpetas'}</strong>
              <span>{folders.length} {folders.length === 1 ? 'carpeta' : 'carpetas'}</span>
            </div>
          </div>

          <div className="fmplus-folder-grid">
            {folders.map(folder => (
              <button
                type="button"
                key={folder.name}
                className="fmplus-folder-card"
                onClick={() => onPathChange([...currentPath, folder.name])}
              >
                <div className="fmplus-folder-visual" aria-hidden="true">
                  <span className="fmplus-folder-emoji">{iconForFolder(folder.name)}</span>
                  <span className="fmplus-folder-tab" />
                </div>
                <div className="fmplus-folder-copy">
                  <strong title={folder.name}>{folder.name}</strong>
                  <span>{folder.fileCount} archivos · {formatCompactBytes(folder.totalBytes)}</span>
                  <div className="fmplus-folder-kinds">
                    {folder.kinds.map(kind => <em key={kind}>{kind}</em>)}
                  </div>
                </div>
                <ChevronRight className="fmplus-folder-chevron" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
