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
    let mut settings: Settings = db.read_json(&db.settings_path).await?;
    if settings.espanso_config_dir.is_none() || settings.espanso_path.is_none() {
        if let Ok(info) = crate::espanso::detector::detect_espanso().await {
            if info.found {
                let patch = serde_json::json!({
                    "espanso_path": info.path,
                    "espanso_config_dir": info.config_dir,
                    "espanso_auto_detected": true,
                });
                settings = db.update_settings(patch).await?;
            }
        }
    }
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

    Ok(checks)
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
