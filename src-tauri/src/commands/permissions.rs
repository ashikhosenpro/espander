use serde::Serialize;
use tauri::State;

use crate::db::database::Database;
use crate::db::schema::Settings;
use crate::error::EspanderError;

#[derive(Debug, Serialize)]
pub struct PermissionCheck {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub action_label: Option<String>,
    pub required: bool,
}

#[tauri::command]
pub async fn get_permission_status(
    db: State<'_, Database>,
) -> Result<Vec<PermissionCheck>, EspanderError> {
    let settings: Settings = db.read_json(&db.settings_path).await?;
    let mut checks = Vec::new();

    checks.push(PermissionCheck {
        id: "app_data_access".to_string(),
        title: "App data access".to_string(),
        description: "Espander can read and write its local database, backups, and YAML cache."
            .to_string(),
        status: if can_write_dir(&db.base_dir) {
            "granted"
        } else {
            "missing"
        }
        .to_string(),
        action_label: None,
        required: true,
    });

    checks.push(PermissionCheck {
        id: "espanso_config_access".to_string(),
        title: "Espanso config access".to_string(),
        description: "Required to deploy generated YAML files into Espanso's match directory."
            .to_string(),
        status: espanso_config_status(settings.espanso_config_dir.as_deref()),
        action_label: None,
        required: true,
    });

    #[cfg(target_os = "macos")]
    checks.push(PermissionCheck {
        id: "macos_accessibility".to_string(),
        title: "macOS Accessibility".to_string(),
        description: "Required by text expansion tools so snippets can be typed into other apps."
            .to_string(),
        status: if macos_accessibility_granted() {
            "granted"
        } else {
            "missing"
        }
        .to_string(),
        action_label: Some("Open Accessibility Settings".to_string()),
        required: true,
    });

    #[cfg(target_os = "windows")]
    checks.push(PermissionCheck {
        id: "windows_startup_apps".to_string(),
        title: "Windows startup apps".to_string(),
        description: "Enable Espanso at startup if you want snippets available after sign-in."
            .to_string(),
        status: "manual".to_string(),
        action_label: Some("Open Startup Apps".to_string()),
        required: false,
    });

    Ok(checks)
}

#[tauri::command]
pub fn open_permission_settings(permission_id: String) -> Result<(), EspanderError> {
    #[cfg(target_os = "macos")]
    {
        let url = match permission_id.as_str() {
            "macos_accessibility" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            }
            "macos_full_disk_access" => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
            }
            _ => "x-apple.systempreferences:com.apple.preference.security",
        };

        std::process::Command::new("open").arg(url).spawn()?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let uri = match permission_id.as_str() {
            "windows_startup_apps" => "ms-settings:startupapps",
            "windows_notifications" => "ms-settings:notifications",
            _ => "ms-settings:privacy",
        };

        std::process::Command::new("cmd")
            .args(["/C", "start", "", uri])
            .spawn()?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = permission_id;
        Ok(())
    }
}

fn espanso_config_status(config_dir: Option<&str>) -> String {
    let Some(config_dir) = config_dir else {
        return "missing".to_string();
    };

    if can_write_dir(std::path::Path::new(config_dir)) {
        "granted".to_string()
    } else {
        "missing".to_string()
    }
}

fn can_write_dir(path: &std::path::Path) -> bool {
    if std::fs::create_dir_all(path).is_err() {
        return false;
    }

    let test_path = path.join(".espander-permission-check");
    match std::fs::write(&test_path, b"ok") {
        Ok(_) => {
            let _ = std::fs::remove_file(test_path);
            true
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(target_os = "macos")]
fn macos_accessibility_granted() -> bool {
    unsafe { AXIsProcessTrusted() }
}
