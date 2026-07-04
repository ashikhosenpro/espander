use crate::db::database::Database;
use crate::error::EspanderError;
use tauri::State;
use tokio::fs;

#[tauri::command]
pub async fn read_about_page(db: State<'_, Database>) -> Result<String, EspanderError> {
    let path = db.base_dir.join("about.html");
    if !path.exists() {
        let default = include_str!("../../defaults/about.html");
        fs::write(&path, default).await?;
        Ok(default.to_string())
    } else {
        let existing = fs::read_to_string(&path).await?;
        if existing.contains("Visual Manager &amp; Cloud Sync Companion for Espanso") {
            let default = include_str!("../../defaults/about.html");
            fs::write(&path, default).await?;
            Ok(default.to_string())
        } else {
            Ok(existing)
        }
    }
}

#[tauri::command]
pub async fn read_docs_page(db: State<'_, Database>) -> Result<String, EspanderError> {
    let path = db.base_dir.join("docs.html");
    if !path.exists() {
        let default = include_str!("../../defaults/docs.html");
        fs::write(&path, default).await?;
        Ok(default.to_string())
    } else {
        let existing = fs::read_to_string(&path).await?;
        if existing.contains("Edit this file to write your own documentation") {
            let default = include_str!("../../defaults/docs.html");
            fs::write(&path, default).await?;
            Ok(default.to_string())
        } else {
            Ok(existing)
        }
    }
}
