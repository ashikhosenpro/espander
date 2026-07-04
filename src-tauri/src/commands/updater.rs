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

#[tauri::command]
pub async fn download_and_install_update(download_url: String) -> Result<String, EspanderError> {
    if !is_allowed_update_download(&download_url) {
        return Err(EspanderError::Other(
            "Update downloads are only allowed from the official release host.".to_string(),
        ));
    }

    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .build()
        .map_err(|e| EspanderError::Other(format!("HTTP client error: {}", e)))?;

    // Download the installer file
    let resp = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| EspanderError::Other(format!("Failed to download update: {}", e)))?;

    if !resp.status().is_success() {
        return Err(EspanderError::Other(format!(
            "Server returned status {}",
            resp.status()
        )));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| EspanderError::Other(format!("Failed to read update bytes: {}", e)))?;

    // Determine target filename from URL or default
    let filename = download_url
        .split('/')
        .last()
        .unwrap_or("espander-update.dmg");

    // Save to temp directory
    let temp_dir = std::env::temp_dir();
    let temp_file_path = temp_dir.join(filename);

    tokio::fs::write(&temp_file_path, bytes)
        .await
        .map_err(|e| EspanderError::Other(format!("Failed to write update file: {}", e)))?;

    // Open/Execute the installer based on OS
    open_installer(&temp_file_path)?;

    Ok(format!("Update downloaded to {:?}", temp_file_path))
}

fn open_installer(path: &std::path::Path) -> Result<(), EspanderError> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| EspanderError::Other(format!("Failed to open installer: {}", e)))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| EspanderError::Other(format!("Failed to run installer: {}", e)))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| EspanderError::Other(format!("Failed to open installer: {}", e)))?;
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Notification {
    pub id: String,
    pub title: String,
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
    pub repeat_daily: bool,
    pub dismissible: bool,
    pub priority: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationsResponse {
    pub notifications: Vec<Notification>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceRegistration {
    pub device_id: String,
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

fn notifications_endpoint_url() -> Option<String> {
    std::env::var("ESPANDER_NOTIFICATIONS_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_NOTIFICATIONS_URL").map(str::to_string))
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
}

fn updates_endpoint_url() -> Option<String> {
    std::env::var("ESPANDER_UPDATES_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_UPDATES_URL").map(str::to_string))
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
        .or_else(|| {
            notifications_endpoint_url()
                .and_then(|url| url.strip_suffix("/notifications").map(str::to_string))
                .map(|base| format!("{}/update", base))
        })
}

fn is_allowed_update_download(download_url: &str) -> bool {
    if download_url.starts_with("https://github.com/ashikhosenpro/Expander/releases/download/") {
        return true;
    }

    let Ok(download) = reqwest::Url::parse(download_url) else {
        return false;
    };

    if download.scheme() != "https" {
        return false;
    }

    let Some(update_url) = updates_endpoint_url() else {
        return false;
    };

    let Ok(update_endpoint) = reqwest::Url::parse(&update_url) else {
        return false;
    };

    download.domain() == update_endpoint.domain()
}

#[tauri::command]
pub async fn register_app_install(device_id: String) -> Result<(), EspanderError> {
    let Some(url) = telemetry_endpoint_url() else {
        return Ok(());
    };

    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| EspanderError::Other(format!("HTTP client error: {}", e)))?;

    let payload = serde_json::json!({
        "device_id": device_id,
        "platform": std::env::consts::OS,
        "version": env!("CARGO_PKG_VERSION"),
    });

    let _ = client.post(url).json(&payload).send().await;
    Ok(())
}

fn telemetry_endpoint_url() -> Option<String> {
    std::env::var("ESPANDER_TELEMETRY_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_TELEMETRY_URL").map(str::to_string))
        .map(|url| url.trim().to_string())
        .filter(|url| !url.is_empty())
        .or_else(|| {
            notifications_endpoint_url()
                .and_then(|url| url.strip_suffix("/notifications").map(str::to_string))
                .map(|base| format!("{}/telemetry", base))
        })
}
