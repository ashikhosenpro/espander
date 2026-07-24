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
        use std::iter;
        use windows_sys::Win32::UI::Shell::ShellExecuteW;
        use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let operation: Vec<u16> = "open".encode_utf16().chain(iter::once(0)).collect();
        let target: Vec<u16> = url.encode_utf16().chain(iter::once(0)).collect();
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        };
        if result as isize <= 32 {
            return Err(EspanderError::Other(format!(
                "Windows could not open the browser (ShellExecute error {}).",
                result as isize
            )));
        }
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(url).spawn()?;
    }

    Ok(())
}
