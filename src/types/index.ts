export interface Snippet {
  id: string;
  trigger: string;
  replace: string;
  category_id: string;
  description: string;
  tags: string[];
  is_favorite: boolean;
  is_paused: boolean;
  source: string;
  created_at: string;
  updated_at: string;
  sync_status: "Local" | "Synced" | "Modified" | "Conflict";
}

export interface CreateSnippetInput {
  trigger: string;
  replace: string;
  category_id?: string;
  description?: string;
  tags?: string[];
  source?: string;
}

export interface UpdateSnippetInput {
  trigger?: string;
  replace?: string;
  category_id?: string;
  description?: string;
  tags?: string[];
  is_favorite?: boolean;
  is_paused?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Settings {
  version: number;
  theme: "dark" | "light" | "system";
  language: string;
  espanso_path: string | null;
  espanso_config_dir: string | null;
  espanso_auto_detected: boolean;
  sync_provider: "github" | "gsheet" | "local";
  sync_interval_minutes: number;
  auto_sync: boolean;
  auto_reload: boolean;
  first_launch_complete: boolean;
  gsheet_csv_url: string | null;
  github_repo_url: string | null;
  github_username: string | null;
  github_repo_owner: string | null;
  github_repo_name: string | null;
  github_token: string | null;
  github_branch: string | null;
  github_path: string | null;
}

export interface SyncMeta {
  provider: string;
  last_sync_at: string | null;
  last_sync_status: string;
  is_syncing: boolean;
  sync_history: SyncEvent[];
}

export interface SyncEvent {
  timestamp: string;
  status: string;
  snippets_pulled: number;
  snippets_pushed: number;
  conflicts: number;
}

export interface EspansoInfo {
  found: boolean;
  path: string | null;
  config_dir: string | null;
  version: string | null;
}

export interface SyncResult {
  success: boolean;
  snippets_pulled: number;
  snippets_pushed: number;
  conflicts: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface GitHubRepo {
  id: number;
  name: string;
  owner: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
}

export interface DeviceFlowResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
}

export interface OAuthResult {
  success: boolean;
  access_token: string | null;
  error: string | null;
}

export type SyncProvider = "github" | "gsheet" | "local";
export type Theme = "dark" | "light" | "system";
export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline";
export type ViewMode = "list" | "grid";

export interface PermissionCheck {
  id: string;
  title: string;
  description: string;
  status: "granted" | "missing" | "manual";
  action_label: string | null;
  required: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type_name: string;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  repeat_daily: boolean;
  dismissible: boolean;
  priority: number;
}
