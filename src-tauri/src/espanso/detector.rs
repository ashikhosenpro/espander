use std::path::PathBuf;
use tokio::process::Command;

use crate::db::schema::EspansoInfo;
use crate::error::EspanderError;

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
    let version = get_version(&path).await.ok();
    let config_dir = get_config_dir(&path).await.ok();

    Ok(EspansoInfo {
        found: true,
        path: Some(path.to_string_lossy().to_string()),
        config_dir: config_dir.map(|p| p.to_string_lossy().to_string()),
        version,
    })
}

async fn find_espanso_binary() -> Result<PathBuf, EspanderError> {
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

    let output = Command::new("which")
        .arg("espanso")
        .output()
        .await
        .map_err(|_| EspanderError::EspansoNotFound("espanso not found in PATH".to_string()))?;

    if output.status.success() {
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path_str.is_empty() {
            return Ok(PathBuf::from(path_str));
        }
    }

    Err(EspanderError::EspansoNotFound(
        "espanso binary not found".to_string(),
    ))
}

async fn get_version(path: &PathBuf) -> Result<String, EspanderError> {
    let output = Command::new(path).arg("--version").output().await?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(EspanderError::EspansoNotFound(
            "failed to get version".to_string(),
        ))
    }
}

pub async fn get_config_dir(path: &PathBuf) -> Result<PathBuf, EspanderError> {
    let output = Command::new(path).arg("path").output().await?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if line.starts_with("Config:") {
                let dir = line.trim_start_matches("Config:").trim();
                return Ok(PathBuf::from(dir));
            }
        }
        // Fallback: common paths
        #[cfg(target_os = "macos")]
        {
            let home = std::env::var("HOME").unwrap_or_default();
            let path = PathBuf::from(format!("{}/Library/Application Support/espanso", home));
            if path.join("match").exists() && path.join("config").exists() {
                return Ok(path);
            }
        }
        Ok(PathBuf::from(stdout.trim()))
    } else {
        Err(EspanderError::EspansoNotFound(
            "failed to get config dir".to_string(),
        ))
    }
}
