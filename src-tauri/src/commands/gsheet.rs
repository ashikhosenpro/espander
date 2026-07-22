use crate::db::database::Database;
use crate::db::schema::{CreateSnippetInput, ImportResult};
use crate::error::EspanderError;

pub async fn import_from_gsheet_url(
    db: &Database,
    url: &str,
) -> Result<ImportResult, EspanderError> {
    if !crate::sync::gsheet::validate_gsheet_url(url) {
        return Err(EspanderError::InvalidCsvUrl(
            "URL must be a published Google Sheets CSV URL".to_string(),
        ));
    }

    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .build()
        .map_err(|e| EspanderError::SyncFailed(format!("Failed to create HTTP client: {}", e)))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| EspanderError::SyncFailed(format!("Failed to fetch CSV: {}", e)))?;

    if !resp.status().is_success() {
        return Err(EspanderError::SyncFailed(format!(
            "Server returned {}",
            resp.status()
        )));
    }

    let csv_text = resp
        .text()
        .await
        .map_err(|e| EspanderError::SyncFailed(format!("Failed to read CSV: {}", e)))?;

    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut errors = Vec::new();

    let existing_snippets = db.get_snippets().await?;
    let mut existing_triggers: std::collections::HashSet<String> = existing_snippets
        .iter()
        .map(|s| s.trigger.to_lowercase())
        .collect();

    let lines: Vec<&str> = csv_text.lines().collect();

    let start_line = if lines
        .first()
        .map_or(false, |l| l.to_lowercase().contains("trigger"))
    {
        1
    } else {
        0
    };

    for (i, line) in lines.iter().enumerate().skip(start_line) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let mut fields = Vec::new();
        let mut current = String::new();
        let mut in_quotes = false;

        for ch in line.chars() {
            match ch {
                '"' => in_quotes = !in_quotes,
                ',' if !in_quotes => {
                    fields.push(current.trim().to_string());
                    current = String::new();
                }
                c => current.push(c),
            }
        }
        fields.push(current.trim().to_string());

        if fields.len() >= 2 {
            let trigger = fields[0].trim_matches('"').trim().to_string();
            let replace = fields[1].trim_matches('"').trim().to_string();

            if !trigger.is_empty() && !replace.is_empty() {
                let trigger_lower = trigger.to_lowercase();
                if existing_triggers.contains(&trigger_lower) {
                    skipped += 1;
                    continue;
                }

                existing_triggers.insert(trigger_lower);

                let input = CreateSnippetInput {
                    trigger,
                    replace,
                    category_id: None,
                    description: None,
                    notes: None,
                    tags: None,
                    source: Some("google_sheets".to_string()),
                    is_protected: false,
                };
                match db.create_snippet(input).await {
                    Ok(_) => imported += 1,
                    Err(e) => {
                        skipped += 1;
                        errors.push(format!("Line {}: {}", i + 1, e));
                    }
                }
            } else {
                skipped += 1;
            }
        } else {
            skipped += 1;
        }
    }

    // Trigger deploy after import
    if imported > 0 {
        if let Err(e) = crate::commands::espanso::deploy_and_reload_inner(db).await {
            eprintln!("deploy_and_reload_inner after gsheet import: {}", e);
            errors.push(format!("Deploy error: {}", e));
        }
    }

    Ok(ImportResult {
        imported,
        skipped,
        errors,
    })
}

#[tauri::command]
pub async fn validate_gsheet_url(url: String) -> Result<bool, EspanderError> {
    Ok(crate::sync::gsheet::validate_gsheet_url(&url))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::database::Database;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_import_from_gsheet_url() {
        let dir = tempdir().unwrap();
        let db = Database::new(dir.path().join(".espander"));
        db.init().await.unwrap();

        let url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRwsUvmhARieAAS01WickL7ZUbworiUmK8Zy3jxu_kjGfH_9v1lRHigiWojThV4jMeIXlcvrQnRTgWZ/pub?output=csv";

        let result = import_from_gsheet_url(&db, url).await.unwrap();
        println!(
            "Imported: {}, Skipped: {}, Errors: {:?}",
            result.imported, result.skipped, result.errors
        );
        assert!(result.imported > 0, "Expected at least 1 snippet imported");
    }
}

#[tauri::command]
pub async fn import_from_gsheet(
    db: tauri::State<'_, Database>,
    url: String,
) -> Result<ImportResult, EspanderError> {
    import_from_gsheet_url(&*db, &url).await
}
