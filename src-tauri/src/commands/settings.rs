use crate::db::database::Database;
use crate::db::schema::Settings;
use crate::error::EspanderError;
use tauri::State;

#[tauri::command]
pub async fn get_settings(db: State<'_, Database>) -> Result<Settings, EspanderError> {
    db.get_settings().await
}

#[tauri::command]
pub async fn update_settings(
    db: State<'_, Database>,
    patch: serde_json::Value,
) -> Result<Settings, EspanderError> {
    db.update_settings(patch).await
}

#[tauri::command]
pub fn open_browser(url: String) -> Result<(), EspanderError> {
    let trimmed = url.trim();
    let allowed = trimmed.starts_with("https://")
        || trimmed.starts_with("http://")
        || trimmed.starts_with("mailto:");
    if !allowed {
        return Err(EspanderError::Other(
            "Blocked unsupported external URL scheme.".to_string(),
        ));
    }

    open_external_url(trimmed)
}

fn open_external_url(url: &str) -> Result<(), EspanderError> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(url).spawn()?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(url).spawn()?;
    }

    Ok(())
}
