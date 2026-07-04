use std::collections::HashSet;
use std::path::Path;

use crate::error::EspanderError;

#[derive(Debug, Clone, Default)]
pub struct DeployStats {
    pub created: usize,
    pub updated: usize,
    pub unchanged: usize,
    pub removed: usize,
}

/// Copy YAML files from yaml_dir to espanso_config_dir/match/espander/.
/// Removes orphaned files from the target. Uses atomic write (write to temp, rename).
pub async fn deploy_yaml_to_espanso(
    yaml_dir: &Path,
    espanso_config_dir: &Path,
) -> Result<DeployStats, EspanderError> {
    let target_dir = espanso_config_dir.join("match").join("espander");
    tokio::fs::create_dir_all(&target_dir).await?;
    let mut stats = DeployStats::default();

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

            let source_bytes = tokio::fs::read(&path).await?;
            if let Ok(target_bytes) = tokio::fs::read(&target_path).await {
                if target_bytes == source_bytes {
                    stats.unchanged += 1;
                    source_files.insert(filename);
                    continue;
                }
                stats.updated += 1;
            } else {
                stats.created += 1;
            }

            // Atomic write: write to a temp file, then rename
            let tmp_path = target_dir.join(format!(".{}.tmp", filename));
            tokio::fs::write(&tmp_path, source_bytes).await?;
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
                stats.removed += 1;
                eprintln!("[espander]   removed orphan: {}", filename);
            }
        }
    }

    Ok(stats)
}
