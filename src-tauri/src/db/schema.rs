use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub trigger: String,
    pub replace: String,
    pub category_id: String,
    pub description: String,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub is_paused: bool,
    #[serde(default = "default_source")]
    pub source: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub sync_status: SyncStatus,
}

fn default_source() -> String {
    "local".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSnippetInput {
    pub trigger: String,
    pub replace: String,
    pub category_id: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSnippetInput {
    pub trigger: Option<String>,
    pub replace: Option<String>,
    pub category_id: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_favorite: Option<bool>,
    pub is_paused: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum SyncStatus {
    #[default]
    Local,
    Synced,
    Modified,
    Conflict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetFile {
    pub version: u32,
    pub snippets: Vec<Snippet>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub sort_order: u32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryFile {
    pub version: u32,
    pub categories: Vec<Category>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub version: u32,
    pub theme: String,
    pub language: String,
    pub espanso_path: Option<String>,
    pub espanso_config_dir: Option<String>,
    pub espanso_auto_detected: bool,
    pub sync_provider: String,
    pub sync_interval_minutes: u32,
    pub auto_sync: bool,
    pub auto_reload: bool,
    pub first_launch_complete: bool,
    pub gsheet_csv_url: Option<String>,
    #[serde(default)]
    pub github_repo_url: Option<String>,
    #[serde(default)]
    pub github_username: Option<String>,
    #[serde(default)]
    pub github_repo_owner: Option<String>,
    #[serde(default)]
    pub github_repo_name: Option<String>,
    #[serde(default)]
    pub github_token: Option<String>,
    #[serde(default)]
    pub github_branch: Option<String>,
    #[serde(default)]
    pub github_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMeta {
    pub version: u32,
    pub provider: String,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub last_sync_status: String,
    pub last_sync_error: Option<String>,
    pub is_syncing: bool,
    pub sync_history: Vec<SyncEvent>,
    pub github: Option<GitHubSyncState>,
    pub gsheet: Option<GSheetSyncState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEvent {
    pub timestamp: DateTime<Utc>,
    pub status: String,
    pub snippets_pulled: u32,
    pub snippets_pushed: u32,
    pub conflicts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSyncState {
    pub access_token: Option<String>,
    pub selected_repo_owner: Option<String>,
    pub selected_repo_name: Option<String>,
    pub device_code: Option<String>,
    pub device_verification_uri: Option<String>,
    pub device_user_code: Option<String>,
    pub device_interval: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GSheetSyncState {
    pub csv_url: Option<String>,
    pub last_import_at: Option<DateTime<Utc>>,
    pub auto_poll: bool,
    pub poll_interval_minutes: u32,
    pub last_import_count: Option<u32>,
}

// API response types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EspansoInfo {
    pub found: bool,
    pub path: Option<String>,
    pub config_dir: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub success: bool,
    pub snippets_pulled: u32,
    pub snippets_pushed: u32,
    pub conflicts: u32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: u32,
    pub skipped: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub interval: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthResult {
    pub success: bool,
    pub access_token: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub owner: String,
    pub full_name: String,
    pub description: Option<String>,
    pub private: bool,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    pub version: String,
    pub name: String,
    pub data_dir: String,
}
