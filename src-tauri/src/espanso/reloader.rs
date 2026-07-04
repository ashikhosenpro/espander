use std::collections::HashSet;
use std::path::Path;
use tokio::process::Command;

use crate::error::EspanderError;

pub async fn reload_espanso(espanso_path: &Path) -> Result<(), EspanderError> {
    if !espanso_path.exists() {
        return Err(EspanderError::EspansoNotFound(
            espanso_path.display().to_string(),
        ));
    }
    if !espanso_path.is_file() {
        return Err(EspanderError::Other(format!(
            "Espanso path is not a file: {}",
            espanso_path.display()
        )));
    }
    eprintln!(
        "[espander] reload_espanso: running {} cmd restart",
        espanso_path.display()
    );
    let output = Command::new(espanso_path)
        .arg("cmd")
        .arg("restart")
        .output()
        .await
        .map_err(|e| EspanderError::EspansoReloadFailed(e.to_string()))?;

    if output.status.success() {
        eprintln!("[espander] reload_espanso: success");
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[espander] reload_espanso: failed: {}", stderr);
        Err(EspanderError::EspansoReloadFailed(stderr.to_string()))
    }
}

/// Copy YAML files from yaml_dir to espanso_config_dir/match/espander/.
/// Removes orphaned files from the target. Uses atomic write (write to temp, rename).
pub async fn deploy_yaml_to_espanso(
    yaml_dir: &Path,
    espanso_config_dir: &Path,
) -> Result<(), EspanderError> {
    let target_dir = espanso_config_dir.join("match").join("espander");
    tokio::fs::create_dir_all(&target_dir).await?;

    eprintln!(
        "[espander] deploy_yaml_to_espanso: from {} to {}",
        yaml_dir.display(),
        target_dir.display()
    );

    // Collect source YAML files
    let mut source_files = HashSet::new();
    let mut dir = tokio::fs::read_dir(yaml_dir).await?;
    while let Some(entry) = dir.next_entry().await? {
        let path = entry.path();
        if path
            .extension()
            .map_or(false, |e| e == "yml" || e == "yaml")
        {
            let filename = path.file_name().unwrap().to_string_lossy().to_string();
            let target_path = target_dir.join(&filename);

            // Atomic write: write to a temp file, then rename
            let tmp_path = target_dir.join(format!(".{}.tmp", filename));
            tokio::fs::copy(&path, &tmp_path).await?;
            tokio::fs::rename(&tmp_path, &target_path).await?;

            eprintln!("[espander]   deployed: {}", filename);
            source_files.insert(filename);
        }
    }

    // Remove orphaned files from target that no longer exist in source
    let mut target_dir_reader = tokio::fs::read_dir(&target_dir).await?;
    while let Some(entry) = target_dir_reader.next_entry().await? {
        let path = entry.path();
        if path
            .extension()
            .map_or(false, |e| e == "yml" || e == "yaml")
        {
            let filename = path.file_name().unwrap().to_string_lossy().to_string();
            if !source_files.contains(&filename) {
                tokio::fs::remove_file(&path).await?;
                eprintln!("[espander]   removed orphan: {}", filename);
            }
        }
    }

    Ok(())
}
