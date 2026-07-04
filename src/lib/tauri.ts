import { invoke } from "@tauri-apps/api/core";
import type {
  Snippet,
  CreateSnippetInput,
  UpdateSnippetInput,
  Category,
  Settings,
  EspansoInfo,
  SyncResult,
  SyncMeta,
  ImportResult,
  DeviceFlowResponse,
  OAuthResult,
  PermissionCheck,
} from "@/types";

// Snippets
export const getSnippets = () => invoke<Snippet[]>("get_snippets");
export const createSnippet = (input: CreateSnippetInput) =>
  invoke<Snippet>("create_snippet", { input });
export const updateSnippet = (id: string, input: UpdateSnippetInput) =>
  invoke<Snippet>("update_snippet", { id, input });
export const deleteSnippet = (id: string) =>
  invoke<void>("delete_snippet", { id });
export const duplicateSnippet = (id: string) =>
  invoke<Snippet>("duplicate_snippet", { id });
export const toggleFavorite = (id: string) =>
  invoke<Snippet>("toggle_favorite", { id });
export const bulkDeleteSnippets = (ids: string[]) =>
  invoke<void>("bulk_delete_snippets", { ids });
export const bulkMoveSnippets = (ids: string[], categoryId: string) =>
  invoke<void>("bulk_move_snippets", { ids, categoryId });


// Categories
export const getCategories = () => invoke<Category[]>("get_categories");
export const createCategory = (name: string) =>
  invoke<Category>("create_category", { name });
export const updateCategory = (id: string, name: string) =>
  invoke<Category>("update_category", { id, name });
export const reorderCategories = (ids: string[]) =>
  invoke<Category[]>("reorder_categories", { ids });
export const deleteCategory = (id: string, deleteSnippets?: boolean) =>
  invoke<void>("delete_category", { id, deleteSnippets });

// Settings
export const getSettings = () => invoke<Settings>("get_settings");
export const updateSettings = (patch: Partial<Settings>) =>
  invoke<Settings>("update_settings", { patch });
export const openBrowser = (url: string) =>
  invoke<void>("open_browser", { url });

// Permissions
export const getPermissionStatus = () =>
  invoke<PermissionCheck[]>("get_permission_status");
export const openPermissionSettings = (permissionId: string) =>
  invoke<void>("open_permission_settings", { permissionId });

// Espanso
export const detectEspanso = () => invoke<EspansoInfo>("detect_espanso");
export const generateYaml = () => invoke<void>("generate_yaml");
export const deployAndReload = () => invoke<void>("deploy_and_reload");

// Sync
export const syncNow = () => invoke<SyncResult>("sync_now");
export const getSyncStatus = () => invoke<SyncMeta>("get_sync_status");
export interface TestConnectionResult {
  success: boolean;
  message: string;
  default_branch?: string;
}
export const testGithubConnection = (repoUrl: string, token: string) =>
  invoke<TestConnectionResult>("test_github_connection", { repoUrl, token });
export const startGitHubOAuth = () =>
  invoke<DeviceFlowResponse>("start_github_oauth");
export const pollGitHubOAuth = (deviceCode: string, interval: number) =>
  invoke<OAuthResult>("poll_github_oauth", { deviceCode, interval });

// Google Sheets
export const validateGSheetUrl = (url: string) =>
  invoke<boolean>("validate_gsheet_url", { url });
export const importFromGSheet = (url: string) =>
  invoke<ImportResult>("import_from_gsheet", { url });

// Backup
export const createBackup = () => invoke<string>("create_backup");
export const restoreBackup = (path: string) =>
  invoke<void>("restore_backup", { path });

// Import/Export
export const importSnippets = (path: string, format: string) =>
  invoke<ImportResult>("import_snippets", { path, format });
export const exportSnippets = (
  path: string,
  format: string,
  ids?: string[]
) => invoke<void>("export_snippets", { path, format, ids });

// Pages
export const readAboutPage = () => invoke<string>("read_about_page");
export const readDocsPage = () => invoke<string>("read_docs_page");

export interface FooterSettings {
  left_text: string;
  link_label: string;
  link_url: string;
  show_github_icon: boolean;
}

export const readFooterSettings = () =>
  invoke<FooterSettings>("read_footer_settings");

// Updater & Announcements
export interface Announcement {
  id: string;
  title: string;
  message: string;
  type_name: string;
  active: boolean;
}

export interface UpdaterInfo {
  version: string;
  release_date: string;
  release_notes: string;
  download_url: string;
  macos_download_url?: string;
  windows_download_url?: string;
  github_releases_url: string;
}

export interface UpdateResponse {
  announcement: Announcement | null;
  updater: UpdaterInfo | null;
  current_version: string;
}

export const checkUpdatesAndAnnouncements = () =>
  invoke<UpdateResponse>("check_updates_and_announcements");

export const downloadAndInstallUpdate = (downloadUrl: string) =>
  invoke<string>("download_and_install_update", { downloadUrl });

// Centralized Notifications
export interface Notification {
  id: string;
  title: string;
  message: string;
  html_content: string | null;
  custom_css: string | null;
  background_color: string | null;
  text_color: string | null;
  action_label: string | null;
  action_url: string | null;
  type_name: string;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  repeat_daily: boolean;
  dismissible: boolean;
  priority: number;
}

export interface NotificationsResponse {
  notifications: Notification[];
}

export const fetchNotifications = () =>
  invoke<NotificationsResponse>("fetch_notifications");

export const registerAppInstall = (deviceId: string) =>
  invoke<void>("register_app_install", { deviceId });

export const moveSnippetsAndDeleteCategory = (fromId: string, toId: string) =>
  invoke<void>("move_snippets_and_delete_category", { fromId, toId });
