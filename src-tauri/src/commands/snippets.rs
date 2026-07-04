use crate::db::database::Database;
use crate::db::schema::*;
use crate::error::EspanderError;
use tauri::State;

use super::espanso::deploy_and_reload_inner;

#[tauri::command]
pub async fn get_snippets(db: State<'_, Database>) -> Result<Vec<Snippet>, EspanderError> {
    db.get_snippets().await
}

#[tauri::command]
pub async fn create_snippet(
    db: State<'_, Database>,
    input: CreateSnippetInput,
) -> Result<Snippet, EspanderError> {
    let snippet = db.create_snippet(input).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after create_snippet: {}", e);
    }
    Ok(snippet)
}

#[tauri::command]
pub async fn update_snippet(
    db: State<'_, Database>,
    id: String,
    input: UpdateSnippetInput,
) -> Result<Snippet, EspanderError> {
    let snippet = db.update_snippet(&id, input).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after update_snippet: {}", e);
    }
    Ok(snippet)
}

#[tauri::command]
pub async fn delete_snippet(db: State<'_, Database>, id: String) -> Result<(), EspanderError> {
    db.delete_snippet(&id).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after delete_snippet: {}", e);
    }
    Ok(())
}

#[tauri::command]
pub async fn duplicate_snippet(
    db: State<'_, Database>,
    id: String,
) -> Result<Snippet, EspanderError> {
    let snippet = db.duplicate_snippet(&id).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after duplicate_snippet: {}", e);
    }
    Ok(snippet)
}

#[tauri::command]
pub async fn toggle_favorite(
    db: State<'_, Database>,
    id: String,
) -> Result<Snippet, EspanderError> {
    let snippet = db.toggle_snippet_favorite(&id).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after toggle_favorite: {}", e);
    }
    Ok(snippet)
}

#[tauri::command]
pub async fn bulk_delete_snippets(
    db: State<'_, Database>,
    ids: Vec<String>,
) -> Result<(), EspanderError> {
    db.bulk_delete_snippets(&ids).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after bulk_delete_snippets: {}", e);
    }
    Ok(())
}

#[tauri::command]
pub async fn bulk_move_snippets(
    db: State<'_, Database>,
    ids: Vec<String>,
    category_id: String,
) -> Result<(), EspanderError> {
    db.bulk_move_snippets(&ids, &category_id).await?;
    if let Err(e) = deploy_and_reload_inner(&db).await {
        eprintln!("deploy_and_reload_inner after bulk_move_snippets: {}", e);
    }
    Ok(())
}
