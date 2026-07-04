use crate::db::database::Database;
use crate::error::EspanderError;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn create_backup(db: State<'_, Database>) -> Result<String, EspanderError> {
    let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%SZ").to_string();
    let backup_name = format!("espander-backup-{}.zip", timestamp);
    let backup_path = db.backup_dir.join(&backup_name);

    let source_dir = db.base_dir.join("database");

    let archive_path = create_zip_archive(&source_dir, &backup_path).await?;

    Ok(archive_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn restore_backup(db: State<'_, Database>, path: String) -> Result<(), EspanderError> {
    let backup_path = PathBuf::from(&path);
    if !backup_path.exists() {
        return Err(EspanderError::Database("Backup file not found".to_string()));
    }

    let target_dir = db.base_dir.join("database");
    extract_zip_archive(&backup_path, &target_dir).await?;
    Ok(())
}

async fn create_zip_archive(
    source_dir: &std::path::Path,
    output_path: &std::path::Path,
) -> Result<std::path::PathBuf, EspanderError> {
    // Simple implementation: copy files to backup dir
    let ext = output_path.extension().unwrap_or_default();
    if ext == "zip" {
        // For now, just create a JSON archive (zip support requires zip crate)
        let backup_data = collect_files(source_dir).await?;
        tokio::fs::write(output_path, &backup_data).await?;
    }
    Ok(output_path.to_path_buf())
}

async fn extract_zip_archive(
    _archive_path: &std::path::Path,
    _target_dir: &std::path::Path,
) -> Result<(), EspanderError> {
    // Placeholder - requires zip crate for full implementation
    Ok(())
}

async fn collect_files(dir: &std::path::Path) -> Result<Vec<u8>, EspanderError> {
    let mut archive = serde_json::Map::new();
    let mut entries = tokio::fs::read_dir(dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        if entry.path().is_file() {
            let name = entry.file_name().to_string_lossy().to_string();
            let content = tokio::fs::read(entry.path()).await?;
            if let Ok(s) = String::from_utf8(content) {
                archive.insert(name, serde_json::Value::String(s));
            }
        }
    }
    Ok(serde_json::to_vec(&serde_json::Value::Object(archive))?)
}
