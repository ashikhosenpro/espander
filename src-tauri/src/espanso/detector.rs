use std::path::PathBuf;

use crate::db::schema::EspansoInfo;
use crate::error::EspanderError;

#[cfg(target_os = "macos")]
const COMMON_MAC_PATHS: &[&str] = &[
    "/opt/homebrew/bin/espanso",
    "/usr/local/bin/espanso",
    "/opt/local/bin/espanso",
];

#[cfg(target_os = "windows")]
const COMMON_WIN_PATHS: &[&str] = &[
    r"C:\Program Files\espanso\bin\espanso.exe",
    r"C:\Program Files (x86)\espanso\bin\espanso.exe",
    r"%LOCALAPPDATA%\espanso\bin\espanso.exe",
];

pub async fn detect_espanso() -> Result<EspansoInfo, EspanderError> {
    if let Ok(info) = try_detect().await {
        if info.found {
            return Ok(info);
        }
    }

    Ok(EspansoInfo {
        found: false,
        path: None,
        config_dir: None,
        version: None,
    })
}

async fn try_detect() -> Result<EspansoInfo, EspanderError> {
    let path = find_espanso_binary().await?;
    let config_dir = get_config_dir();

    Ok(EspansoInfo {
        found: true,
        path: Some(path.to_string_lossy().to_string()),
        config_dir: config_dir.map(|p| p.to_string_lossy().to_string()),
        version: None,
    })
}

async fn find_espanso_binary() -> Result<PathBuf, EspanderError> {
    #[cfg(target_os = "macos")]
    for p in COMMON_MAC_PATHS {
        let path = PathBuf::from(p);
        if path.exists() {
            return Ok(path);
        }
    }

    #[cfg(target_os = "windows")]
    for p in COMMON_WIN_PATHS {
        let expanded = shellexpand::full(p).unwrap_or(std::borrow::Cow::Borrowed(p));
        let path = PathBuf::from(expanded.as_ref());
        if path.exists() {
            return Ok(path);
        }
    }

    if let Some(paths) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&paths) {
            let candidate = if cfg!(target_os = "windows") {
                dir.join("espanso.exe")
            } else {
                dir.join("espanso")
            };
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    Err(EspanderError::EspansoNotFound(
        "espanso binary not found".to_string(),
    ))
}

pub fn get_config_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        return std::env::var("HOME")
            .ok()
            .map(|home| PathBuf::from(home).join("Library/Application Support/espanso"));
    }

    #[cfg(target_os = "windows")]
    {
        return std::env::var("APPDATA")
            .ok()
            .map(|app_data| PathBuf::from(app_data).join("espanso"));
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(config_home) = std::env::var("XDG_CONFIG_HOME") {
            return Some(PathBuf::from(config_home).join("espanso"));
        }
        return std::env::var("HOME")
            .ok()
            .map(|home| PathBuf::from(home).join(".config/espanso"));
    }

    #[allow(unreachable_code)]
    None
}
