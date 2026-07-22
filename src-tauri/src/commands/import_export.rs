use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::State;

use crate::db::database::Database;
use crate::db::schema::*;
use crate::error::EspanderError;

#[derive(Debug, Serialize, Deserialize)]
struct PortableYamlFile {
    version: u32,
    categories: Vec<PortableCategory>,
    snippets: Vec<PortableSnippet>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PortableCategory {
    id: String,
    name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PortableSnippet {
    trigger: String,
    replace: String,
    category: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    notes: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    #[serde(default)]
    is_protected: bool,
}

#[derive(Debug, Deserialize)]
struct EspansoYamlFile {
    matches: Vec<EspansoYamlMatch>,
}

#[derive(Debug, Deserialize)]
struct EspansoYamlMatch {
    trigger: String,
    replace: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    tags: Option<Vec<String>>,
    #[serde(default)]
    is_protected: bool,
}

#[tauri::command]
pub async fn import_snippets(
    db: State<'_, Database>,
    path: String,
    format: String,
) -> Result<ImportResult, EspanderError> {
    let file_path = PathBuf::from(&path);
    let content = tokio::fs::read_to_string(&file_path).await?;

    match format.as_str() {
        "csv" => import_csv(&db, &content).await,
        "yaml" | "yml" => import_yaml(&db, &content, &file_path).await,
        _ => Err(EspanderError::Other(format!(
            "Unsupported format: {}. Use CSV or YAML.",
            format
        ))),
    }
}

#[tauri::command]
pub async fn export_snippets(
    db: State<'_, Database>,
    path: String,
    format: String,
    ids: Option<Vec<String>>,
) -> Result<(), EspanderError> {
    let all_snippets = db.get_snippets().await?;

    let snippets: Vec<Snippet> = if let Some(ids) = ids {
        all_snippets
            .into_iter()
            .filter(|s| ids.contains(&s.id))
            .collect()
    } else {
        all_snippets
    };

    let content = match format.as_str() {
        "csv" => export_csv(&snippets),
        "yaml" | "yml" => export_yaml(&db, &snippets).await?,
        _ => {
            return Err(EspanderError::Other(format!(
                "Unsupported format: {}. Use CSV or YAML.",
                format
            )))
        }
    };

    tokio::fs::write(PathBuf::from(path), content).await?;
    Ok(())
}

async fn import_csv(db: &Database, content: &str) -> Result<ImportResult, EspanderError> {
    let rows = parse_csv(content);
    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut errors = Vec::new();

    for row in rows.into_iter().skip(1) {
        if row.len() < 2 {
            skipped += 1;
            continue;
        }

        let trigger = row[0].trim();
        let replace = row[1].trim();
        if trigger.is_empty() || replace.is_empty() {
            skipped += 1;
            continue;
        }

        let category_id = row
            .get(2)
            .map(|s| normalize_category_id(s))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "global".to_string());
        ensure_category(db, &category_id).await?;

        let description = row
            .get(3)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let notes = row
            .get(4)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let tags = row
            .get(5)
            .map(|s| {
                s.split('|')
                    .map(|tag| tag.trim().to_string())
                    .filter(|tag| !tag.is_empty())
                    .collect::<Vec<_>>()
            })
            .filter(|tags| !tags.is_empty());

        let input = CreateSnippetInput {
            trigger: trigger.to_string(),
            replace: replace.to_string(),
            category_id: Some(category_id),
            description,
            notes,
            tags,
            source: Some("local".to_string()),
            is_protected: row
                .get(6)
                .map(|value| value.trim().eq_ignore_ascii_case("true"))
                .unwrap_or(false),
        };

        match db.create_snippet(input).await {
            Ok(_) => imported += 1,
            Err(e) => errors.push(e.to_string()),
        }
    }

    Ok(ImportResult {
        imported,
        skipped,
        errors,
    })
}

async fn import_yaml(
    db: &Database,
    content: &str,
    file_path: &Path,
) -> Result<ImportResult, EspanderError> {
    if let Ok(portable) = serde_yaml::from_str::<PortableYamlFile>(content) {
        for category in portable.categories {
            let category_id = normalize_category_id(&category.id);
            ensure_named_category(db, &category_id, &category.name).await?;
        }

        return import_portable_snippets(db, portable.snippets).await;
    }

    let espanso: EspansoYamlFile = serde_yaml::from_str(content)?;
    let category_id = file_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(normalize_category_id)
        .filter(|id| !id.is_empty())
        .unwrap_or_else(|| "global".to_string());
    ensure_category(db, &category_id).await?;

    let snippets = espanso
        .matches
        .into_iter()
        .map(|m| PortableSnippet {
            trigger: m.trigger,
            replace: m.replace,
            category: category_id.clone(),
            description: m.description,
            notes: None,
            tags: m.tags.unwrap_or_default(),
            is_protected: m.is_protected,
        })
        .collect();

    import_portable_snippets(db, snippets).await
}

async fn import_portable_snippets(
    db: &Database,
    snippets: Vec<PortableSnippet>,
) -> Result<ImportResult, EspanderError> {
    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut errors = Vec::new();

    for snippet in snippets {
        let category_id = normalize_category_id(&snippet.category);
        if snippet.trigger.trim().is_empty() || snippet.replace.trim().is_empty() {
            skipped += 1;
            continue;
        }

        ensure_category(db, &category_id).await?;
        let input = CreateSnippetInput {
            trigger: snippet.trigger.trim().to_string(),
            replace: snippet.replace,
            category_id: Some(category_id),
            description: snippet.description,
            notes: snippet.notes,
            tags: Some(snippet.tags),
            source: Some("local".to_string()),
            is_protected: snippet.is_protected,
        };

        match db.create_snippet(input).await {
            Ok(_) => imported += 1,
            Err(e) => errors.push(e.to_string()),
        }
    }

    Ok(ImportResult {
        imported,
        skipped,
        errors,
    })
}

fn export_csv(snippets: &[Snippet]) -> String {
    let mut csv = "trigger,replace,category,description,notes,tags,is_protected\n".to_string();
    for s in snippets {
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            csv_escape(&s.trigger),
            csv_escape(&s.replace),
            csv_escape(&s.category_id),
            csv_escape(&s.description),
            csv_escape(s.notes.as_deref().unwrap_or("")),
            csv_escape(&s.tags.join("|")),
            s.is_protected,
        ));
    }
    csv
}

async fn export_yaml(db: &Database, snippets: &[Snippet]) -> Result<String, EspanderError> {
    let categories_file: CategoryFile = db.read_json(&db.categories_path).await?;
    let categories = categories_file
        .categories
        .into_iter()
        .filter(|category| snippets.iter().any(|s| s.category_id == category.id))
        .map(|category| PortableCategory {
            id: category.id,
            name: category.name,
        })
        .collect();

    let snippets = snippets
        .iter()
        .map(|s| PortableSnippet {
            trigger: s.trigger.clone(),
            replace: s.replace.clone(),
            category: s.category_id.clone(),
            description: if s.description.is_empty() {
                None
            } else {
                Some(s.description.clone())
            },
            notes: s.notes.clone(),
            tags: s.tags.clone(),
            is_protected: s.is_protected,
        })
        .collect();

    let yaml = PortableYamlFile {
        version: 1,
        categories,
        snippets,
    };
    serde_yaml::to_string(&yaml).map_err(EspanderError::from)
}

async fn ensure_category(db: &Database, id: &str) -> Result<(), EspanderError> {
    let name = id_to_category_name(id);
    ensure_named_category(db, id, &name).await
}

async fn ensure_named_category(db: &Database, id: &str, name: &str) -> Result<(), EspanderError> {
    let mut file: CategoryFile = db.read_json(&db.categories_path).await?;
    if file.categories.iter().any(|category| category.id == id) {
        return Ok(());
    }

    let max_order = file
        .categories
        .iter()
        .map(|category| category.sort_order)
        .max()
        .unwrap_or(0);
    file.categories.push(Category {
        id: id.to_string(),
        name: if name.trim().is_empty() {
            id_to_category_name(id)
        } else {
            name.trim().to_string()
        },
        icon: "folder".to_string(),
        color: "#6366f1".to_string(),
        sort_order: max_order + 1,
        created_at: Utc::now(),
    });

    db.write_json(&db.categories_path, &file).await
}

fn normalize_category_id(value: &str) -> String {
    let normalized = value
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>();

    let compact = normalized
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if compact.is_empty() {
        "global".to_string()
    } else {
        compact
    }
}

fn id_to_category_name(id: &str) -> String {
    if id == "global" {
        return "Global".to_string();
    }

    id.split('-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn csv_escape(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}

fn parse_csv(content: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut field = String::new();
    let mut chars = content.chars().peekable();
    let mut in_quotes = false;

    while let Some(ch) = chars.next() {
        match ch {
            '"' if in_quotes && chars.peek() == Some(&'"') => {
                field.push('"');
                chars.next();
            }
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => {
                row.push(field.clone());
                field.clear();
            }
            '\n' if !in_quotes => {
                row.push(field.clone());
                field.clear();
                rows.push(row.clone());
                row.clear();
            }
            '\r' if !in_quotes => {}
            _ => field.push(ch),
        }
    }

    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }

    rows
}
