use crate::error::EspanderError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Announcement {
    pub id: String,
    pub title: String,
    pub message: String,
    pub type_name: String, // "info", "warning", "success", "danger"
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdaterInfo {
    pub version: String,
    pub release_date: String,
    pub release_notes: String,
    pub download_url: String,
    #[serde(default)]
    pub macos_download_url: Option<String>,
    #[serde(default)]
    pub windows_download_url: Option<String>,
    pub github_releases_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateResponse {
    pub announcement: Option<Announcement>,
    pub updater: Option<UpdaterInfo>,
    pub current_version: String,
}

#[tauri::command]
pub async fn check_updates_and_announcements() -> Result<UpdateResponse, EspanderError> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let Some(url) = updates_endpoint_url() else {
        return Ok(UpdateResponse {
            announcement: None,
            updater: None,
            current_version,
        });
    };

    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| EspanderError::Other(format!("HTTP client error: {}", e)))?;

    match client.get(url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                #[derive(Deserialize)]
                struct RemoteData {
                    announcement: Option<Announcement>,
                    updater: Option<UpdaterInfo>,
                }

                if let Ok(mut data) = resp.json::<RemoteData>().await {
                    if let Some(updater) = data.updater.as_mut() {
                        updater.download_url = platform_download_url(updater);
                    }
                    return Ok(UpdateResponse {
                        announcement: data.announcement,
                        updater: data.updater,
                        current_version,
                    });
                }
            }
            Ok(UpdateResponse {
                announcement: None,
                updater: None,
                current_version,
            })
        }
        Err(_) => {
            // Return empty info if request fails (e.g. offline)
            Ok(UpdateResponse {
                announcement: None,
                updater: None,
                current_version,
            })
        }
    }
}

fn platform_download_url(updater: &UpdaterInfo) -> String {
    #[cfg(target_os = "macos")]
    if let Some(url) = updater.macos_download_url.as_ref() {
        return url.clone();
    }

    #[cfg(target_os = "windows")]
    if let Some(url) = updater.windows_download_url.as_ref() {
        return url.clone();
    }

    updater.download_url.clone()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Notification {
    pub id: String,
    #[serde(default)]
    pub content_type: Option<String>,
    #[serde(default)]
    pub top_display_mode: Option<String>,
    #[serde(default)]
    pub top_visibility_mode: Option<String>,
    #[serde(default)]
    pub top_visible_views: Option<Vec<String>>,
    pub title: String,
    #[serde(default)]
    pub excerpt: Option<String>,
    pub message: String,
    #[serde(default)]
    pub html_content: Option<String>,
    #[serde(default)]
    pub custom_css: Option<String>,
    #[serde(default)]
    pub background_color: Option<String>,
    #[serde(default)]
    pub text_color: Option<String>,
    #[serde(default)]
    pub action_label: Option<String>,
    #[serde(default)]
    pub action_url: Option<String>,
    pub type_name: String, // "info", "success", "warning", "error"
    pub active: bool,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub schedule_mode: Option<String>,
    #[serde(default)]
    pub schedule_interval_days: Option<i32>,
    #[serde(default)]
    pub schedule_time_windows: Option<Vec<String>>,
    #[serde(default)]
    pub schedule_window_minutes: Option<i32>,
    #[serde(default)]
    pub schedule_max_per_day: Option<i32>,
    pub repeat_daily: bool,
    pub dismissible: bool,
    pub priority: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationsResponse {
    pub notifications: Vec<Notification>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HubTool {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub image_url: Option<String>,
    pub short_description: String,
    pub button_label: String,
    pub button_url: String,
    pub active: bool,
    pub sort_order: i32,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HubToolsResponse {
    pub tools: Vec<HubTool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalTexts {
    pub more_tools_title: String,
    pub more_tools_subtitle: String,
    pub notifications_title: String,
    pub notifications_subtitle: String,
}

#[tauri::command]
pub async fn fetch_notifications() -> Result<NotificationsResponse, EspanderError> {
    let Some(url) = notifications_endpoint_url() else {
        return Ok(NotificationsResponse {
            notifications: Vec::new(),
        });
    };

    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| EspanderError::Other(format!("HTTP client error: {}", e)))?;

    match client.get(url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<NotificationsResponse>().await {
                    return Ok(data);
                }
            }
            Ok(NotificationsResponse {
                notifications: Vec::new(),
            })
        }
        Err(_) => Ok(NotificationsResponse {
            notifications: Vec::new(),
        }),
    }
}

#[tauri::command]
pub async fn fetch_hub_tools() -> Result<HubToolsResponse, EspanderError> {
    let Some(url) = tools_endpoint_url() else {
        return Ok(HubToolsResponse { tools: Vec::new() });
    };

    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| EspanderError::Other(format!("HTTP client error: {}", e)))?;

    match client.get(url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<HubToolsResponse>().await {
                    return Ok(data);
                }
            }
            Ok(HubToolsResponse { tools: Vec::new() })
        }
        Err(_) => Ok(HubToolsResponse { tools: Vec::new() }),
    }
}

#[tauri::command]
pub async fn fetch_global_texts() -> Result<GlobalTexts, EspanderError> {
    let defaults = GlobalTexts {
        more_tools_title: "More Tools".to_string(),
        more_tools_subtitle: "Useful tools and products from Espander.".to_string(),
        notifications_title: "Notifications".to_string(),
        notifications_subtitle: "Messages and announcements from Espander.".to_string(),
    };

    let Some(url) = global_texts_endpoint_url() else {
        return Ok(defaults);
    };

    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| EspanderError::Other(format!("HTTP client error: {}", e)))?;

    match client.get(url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<GlobalTexts>().await {
                    return Ok(data);
                }
            }
            Ok(defaults)
        }
        Err(_) => Ok(defaults),
    }
}

fn notifications_endpoint_url() -> Option<String> {
    std::env::var("ESPANDER_NOTIFICATIONS_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_NOTIFICATIONS_URL").map(str::to_string))
        .map(|url| url.trim().trim_end_matches('/').to_string())
        .filter(|url| !url.is_empty())
}

fn updates_endpoint_url() -> Option<String> {
    std::env::var("ESPANDER_UPDATES_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_UPDATES_URL").map(str::to_string))
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
        .or_else(|| hub_base_url().map(|base| format!("{}/update", base)))
}

fn tools_endpoint_url() -> Option<String> {
    std::env::var("ESPANDER_TOOLS_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_TOOLS_URL").map(str::to_string))
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
        .or_else(|| hub_base_url().map(|base| format!("{}/tools", base)))
}

fn global_texts_endpoint_url() -> Option<String> {
    std::env::var("ESPANDER_GLOBAL_TEXTS_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_GLOBAL_TEXTS_URL").map(str::to_string))
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
        .or_else(|| hub_base_url().map(|base| format!("{}/global-texts", base)))
}

fn hub_base_url() -> Option<String> {
    notifications_endpoint_url()
        .and_then(|url| url.strip_suffix("/notifications").map(str::to_string))
}
