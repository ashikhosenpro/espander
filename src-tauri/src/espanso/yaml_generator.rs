use std::collections::BTreeMap;
use std::path::Path;
use tokio::fs;

use crate::db::schema::Snippet;
use crate::error::EspanderError;

pub async fn generate_yaml_files(
    snippets: &[Snippet],
    yaml_dir: &Path,
) -> Result<(), EspanderError> {
    fs::create_dir_all(yaml_dir).await?;

    let mut grouped: BTreeMap<String, Vec<&Snippet>> = BTreeMap::new();
    for snippet in snippets {
        grouped
            .entry(snippet.category_id.clone())
            .or_default()
            .push(snippet);
    }

    for (category, category_snippets) in &grouped {
        let yaml_content = generate_category_yaml(category_snippets);
        let filename = format!("{}.yml", category);
        let filepath = yaml_dir.join(&filename);

        // Atomic write: write to a temp file, then rename
        let tmp_path = yaml_dir.join(format!(".{}.tmp", filename));
        fs::write(&tmp_path, &yaml_content).await?;
        fs::rename(&tmp_path, &filepath).await?;

        eprintln!(
            "[espander]   generated: {} ({} snippets)",
            filename,
            category_snippets.len()
        );
    }

    Ok(())
}

fn generate_category_yaml(snippets: &[&Snippet]) -> String {
    let mut output = String::new();
    output.push_str("matches:\n");

    for snippet in snippets {
        let trigger = yaml_escape(&snippet.trigger);
        let replace = yaml_escape(&snippet.replace);
        output.push_str(&format!("  - trigger: \"{}\"\n", trigger));
        output.push_str(&format!("    replace: \"{}\"\n", replace));
    }

    output
}

fn yaml_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
        .replace('\0', "\\0")
        .replace('\u{0008}', "\\b")
        .replace('\u{000C}', "\\f")
}

pub async fn cleanup_old_yaml(
    yaml_dir: &Path,
    active_categories: &[String],
) -> Result<(), EspanderError> {
    let mut dir = fs::read_dir(yaml_dir).await?;
    while let Some(entry) = dir.next_entry().await? {
        let path = entry.path();
        if path.extension().map_or(false, |e| e == "yml") {
            if let Some(stem) = path.file_stem() {
                let category = stem.to_string_lossy();
                if !active_categories.contains(&category.to_string()) {
                    fs::remove_file(&path).await?;
                    eprintln!("[espander]   cleaned up: {} (no snippets)", category);
                }
            }
        }
    }
    Ok(())
}
