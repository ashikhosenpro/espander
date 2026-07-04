use crate::db::database::Database;
use crate::db::schema::Category;
use crate::error::EspanderError;
use tauri::State;

use super::espanso::deploy_and_reload_inner;

#[tauri::command]
pub async fn get_categories(db: State<'_, Database>) -> Result<Vec<Category>, EspanderError> {
    db.get_categories().await
}

#[tauri::command]
pub async fn create_category(
    db: State<'_, Database>,
    name: String,
) -> Result<Category, EspanderError> {
    let category = db.create_category(name).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after create_category: {}", e);
    }
    Ok(category)
}

#[tauri::command]
pub async fn delete_category(
    db: State<'_, Database>,
    id: String,
    delete_snippets: Option<bool>,
) -> Result<(), EspanderError> {
    db.delete_category(&id, delete_snippets.unwrap_or(false))
        .await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after delete_category: {}", e);
    }
    Ok(())
}

#[tauri::command]
pub async fn move_snippets_and_delete_category(
    db: State<'_, Database>,
    from_id: String,
    to_id: String,
) -> Result<(), EspanderError> {
    // 1. Move snippets
    let mut snippets_file = db
        .read_json::<crate::db::schema::SnippetFile>(&db.snippets_path)
        .await?;
    for snippet in snippets_file.snippets.iter_mut() {
        if snippet.category_id == from_id {
            snippet.category_id = to_id.clone();
            snippet.updated_at = chrono::Utc::now();
            if snippet.sync_status == crate::db::schema::SyncStatus::Synced {
                snippet.sync_status = crate::db::schema::SyncStatus::Modified;
            }
        }
    }
    db.write_json(&db.snippets_path, &snippets_file).await?;

    // 2. Delete category
    db.delete_category(&from_id, false).await?;

    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!(
            "deploy_and_reload_inner after move_snippets_and_delete_category: {}",
            e
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn update_category(
    db: State<'_, Database>,
    id: String,
    name: String,
) -> Result<Category, EspanderError> {
    let category = db.update_category(&id, name).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after update_category: {}", e);
    }
    Ok(category)
}

#[tauri::command]
pub async fn reorder_categories(
    db: State<'_, Database>,
    ids: Vec<String>,
) -> Result<Vec<Category>, EspanderError> {
    let categories = db.reorder_categories(ids).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after reorder_categories: {}", e);
    }
    Ok(categories)
}
