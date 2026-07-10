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
        // Injecting a newline as simulated keys can submit single-line fields such as
        // a browser address bar. Clipboard mode inserts multiline replacements as a
        // single paste operation instead.
        if snippet.replace.contains(['\n', '\r']) {
            output.push_str("    force_mode: clipboard\n");
        }
    }

    output
}

#[cfg(test)]
mod tests {
    use super::generate_category_yaml;
    use crate::db::schema::{Snippet, SyncStatus};
    use chrono::Utc;

    fn snippet(replace: &str) -> Snippet {
        Snippet {
            id: "snippet-1".into(),
            trigger: ":test".into(),
            replace: replace.into(),
            category_id: "personal".into(),
            description: String::new(),
            tags: vec![],
            is_favorite: false,
            is_paused: false,
            is_protected: false,
            source: "local".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sync_status: SyncStatus::Local,
        }
    }

    #[test]
    fn multiline_replacements_use_clipboard_mode() {
        let snippet = snippet("Hello,\nHow are you? $|$");
        let yaml = generate_category_yaml(&[&snippet]);

        assert!(yaml.contains("replace: \"Hello,\\nHow are you? $|$\""));
        assert!(yaml.contains("force_mode: clipboard"));
    }

    #[test]
    fn single_line_replacements_keep_automatic_injection_mode() {
        let snippet = snippet("Hello, how are you?");
        let yaml = generate_category_yaml(&[&snippet]);

        assert!(!yaml.contains("force_mode"));
    }
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
