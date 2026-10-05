import { invoke } from '@tauri-apps/api/core';
import type { TelegramFile } from '../types';
import { DEFAULT_SEARCH_FILTERS, filterAndRankFiles, type FileSearchFilters } from './fileSearch';
import { normalizeListedFile } from './fileListRefresh';

export interface WorkspaceFile extends TelegramFile {
    key: string;
    folder_id: number | null;
    folderName: string;
    tags: string[];
    collectionIds: string[];
}
export interface Collection { id: string; name: string; color: string; icon: string; coverKey: string | null }
export interface SavedSearch {
    id: string; name: string; query: string; filters: FileSearchFilters; tags: string[];
    folderKey?: string | null; collectionId?: string | null; favoritesOnly?: boolean;
}
export interface WorkspaceSnapshot {
    ownerId: string;
    files: WorkspaceFile[];
    collections: Collection[];
    searches: SavedSearch[];
    scans: { folderId: number | null; folderName: string; complete: boolean; updatedAt: number }[];
}
export type WorkspaceMutation =
    | { type: 'save_collection'; collection: Collection }
    | { type: 'remove_collection'; id: string }
    | { type: 'assign'; keys: string[]; collection: string; add: boolean }
    | { type: 'tag'; keys: string[]; tag: string; add: boolean }
    | { type: 'save_search'; search: SavedSearch }
    | { type: 'remove_search'; id: string }
    | { type: 'favorite'; key: string; value: boolean };

type SmartCollectionRule = {
    key: string;
    name: string;
    color: Collection['color'];
    icon: Collection['icon'];
    prefixes: string[];
};

export const SMART_COLLECTION_RULES: SmartCollectionRule[] = [
    { key: 'GLO', name: 'GLO', color: 'violet', icon: 'heart', prefixes: ['GLO_'] },
    { key: 'KAT', name: 'KAT', color: 'rose', icon: 'heart', prefixes: ['KAT_'] },
    { key: 'FAMOSAS_CHILE', name: 'Famosas Chile', color: 'amber', icon: 'film', prefixes: ['FAMOSAS_CHILE_'] },
    { key: 'SCREENSHOTS', name: 'Screenshots', color: 'blue', icon: 'folder', prefixes: ['SCREENSHOTS_'] },
    { key: 'DOWNLOAD', name: 'Descargas', color: 'green', icon: 'folder', prefixes: ['DOWNLOAD_'] },
    { key: 'CONTENIDO', name: 'Contenido', color: 'violet', icon: 'film', prefixes: ['CONTENIDO_'] },
    { key: 'FACEBOOK', name: 'Facebook', color: 'blue', icon: 'folder', prefixes: ['FACEBOOK_'] },
    { key: 'REMINI', name: 'Remini', color: 'amber', icon: 'film', prefixes: ['REMINI_'] },
    { key: 'PHOTOROOM', name: 'PhotoRoom', color: 'rose', icon: 'film', prefixes: ['PHOTOROOM_'] },
    { key: 'PHOTODIRECTOR', name: 'PhotoDirector', color: 'violet', icon: 'film', prefixes: ['PHOTODIRECTOR_'] },
    { key: 'CANVA', name: 'Canva', color: 'blue', icon: 'film', prefixes: ['CANVA_'] },
    { key: 'CAVE', name: 'Cave', color: 'slate', icon: 'folder', prefixes: ['CAVE_'] },
    { key: 'CAROLA', name: 'Carola', color: 'rose', icon: 'heart', prefixes: ['CAROLA_'] },
];

export function isSmartCollectionId(id: string): boolean {
    return id.startsWith('smart:');
}

function normalizedCollectionKey(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function smartRuleForCollection(collection: Collection): SmartCollectionRule | undefined {
    const key = normalizedCollectionKey(collection.name);
    return SMART_COLLECTION_RULES.find(rule => rule.key === key);
}

function fileMatchesRule(file: WorkspaceFile, rule: SmartCollectionRule): boolean {
    const name = String(file.name || '').toUpperCase();
    return rule.prefixes.some(prefix => name.startsWith(prefix.toUpperCase()));
}

function normalize(snapshot: WorkspaceSnapshot, ownerId: string): WorkspaceSnapshot {
    if (snapshot.ownerId !== ownerId) throw new Error('ACCOUNT_CHANGED');

    const existingCollections = snapshot.collections ?? [];
    const collections = [...existingCollections];

    for (const rule of SMART_COLLECTION_RULES) {
        const alreadyExists = existingCollections.some(collection => normalizedCollectionKey(collection.name) === rule.key);
        if (!alreadyExists) {
            collections.push({
                id: `smart:${rule.key}`,
                name: rule.name,
                color: rule.color,
                icon: rule.icon,
                coverKey: null,
            });
        }
    }

    const files = snapshot.files.map(file => {
        const normalized = { ...file, ...normalizeListedFile(file) } as WorkspaceFile;
        const automaticIds = collections.flatMap(collection => {
            const rule = smartRuleForCollection(collection);
            return rule && fileMatchesRule(normalized, rule) ? [collection.id] : [];
        });
        return {
            ...normalized,
            collectionIds: [...new Set([...(normalized.collectionIds ?? []), ...automaticIds])],
        };
    });

    return {
        ...snapshot,
        files,
        collections,
        searches: snapshot.searches.map(search => ({
            ...search,
            filters: { ...DEFAULT_SEARCH_FILTERS, ...search.filters },
            tags: search.tags ?? [],
            folderKey: search.folderKey ?? null,
            collectionId: search.collectionId ?? null,
            favoritesOnly: search.favoritesOnly ?? false,
        })),
    };
}
const mutations = new Map<string, Promise<WorkspaceSnapshot>>();
export async function readWorkspace(ownerId: string): Promise<WorkspaceSnapshot> {
    await mutations.get(ownerId)?.catch(() => undefined);
    return normalize(await invoke<WorkspaceSnapshot>('cmd_workspace_read', { ownerId }), ownerId);
}
export function mutateWorkspace(ownerId: string, mutation: WorkspaceMutation): Promise<WorkspaceSnapshot> {
    const operation = (mutations.get(ownerId) ?? Promise.resolve()).catch(() => undefined)
        .then(async () => normalize(await invoke<WorkspaceSnapshot>('cmd_workspace_mutate', { ownerId, mutation }), ownerId));
    mutations.set(ownerId, operation);
    void operation.finally(() => { if (mutations.get(ownerId) === operation) mutations.delete(ownerId); }).catch(() => undefined);
    return operation;
}
export async function indexWorkspace(ownerId: string, folderIds: (number | null)[]): Promise<WorkspaceSnapshot> {
    return normalize(await invoke<WorkspaceSnapshot>('cmd_workspace_index', { ownerId, folderIds }), ownerId);
}
export function savedSearchFolder(search: SavedSearch): number | null | 'all' {
    if (search.folderKey === 'saved') return null;
    if (!search.folderKey) return 'all';
    const id = Number(search.folderKey);
    return Number.isSafeInteger(id) && id > 0 ? id : 'all';
}
export function workspaceFileKey(file: Pick<TelegramFile, 'id' | 'folder_id'>, fallback: number | null = null): string {
    const folder = file.folder_id === undefined ? fallback : file.folder_id;
    return `${folder === null ? 'saved' : folder}:${file.id}`;
}
export function filterWorkspaceFiles(files: WorkspaceFile[], query: string, filters: FileSearchFilters, collection: string | null, tags: string[], folder: number | null | 'all' = 'all'): WorkspaceFile[] {
    const candidates = files.filter(file => (!collection || file.collectionIds.includes(collection))
        && tags.every(tag => file.tags.some(value => value.toLocaleLowerCase() === tag.toLocaleLowerCase()))
        && (folder === 'all' || file.folder_id === folder));
    return filterAndRankFiles(candidates, query, filters) as WorkspaceFile[];
}
export function timelineMonth(file: TelegramFile): string {
    const date = new Date(file.created_at || '');
    return Number.isFinite(date.valueOf()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown';
}
export function groupTimeline(files: WorkspaceFile[]): { month: string; files: WorkspaceFile[] }[] {
    const groups = new Map<string, WorkspaceFile[]>();
    for (const file of [...files].sort((a, b) => (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0))) {
        const month = timelineMonth(file);
        const group = groups.get(month);
        if (group) group.push(file);
        else groups.set(month, [file]);
    }
    return [...groups].map(([month, files]) => ({ month, files }));
}

export const ORGANIZE_FILES_EVENT = 'workspace-organize-files';
export function requestFileOrganization(file: TelegramFile, folder: number | null): void {
    window.dispatchEvent(new CustomEvent(ORGANIZE_FILES_EVENT, { detail: { keys: [workspaceFileKey(file, folder)] } }));
}
