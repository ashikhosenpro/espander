use crate::db::database::Database;
use crate::db::schema::EspansoInfo;
use crate::error::EspanderError;
use crate::espanso::detector;
use crate::espanso::yaml_generator;
use tauri::State;

#[derive(Debug, Clone)]
pub struct DeployOutcome {
    pub created: usize,
    pub updated: usize,
    pub unchanged: usize,
    pub removed: usize,
}

impl DeployOutcome {
    pub fn changed_count(&self) -> usize {
        self.created + self.updated + self.removed
    }

    pub fn message(&self, prefix: &str) -> String {
        let base = if self.changed_count() == 0 {
            format!("{prefix} Already synced with Espanso.")
        } else {
            format!(
                "{prefix} Synced with Espanso: {} created, {} updated, {} removed.",
                self.created, self.updated, self.removed
            )
        };

        base
    }
}

#[tauri::command]
pub async fn detect_espanso() -> Result<EspansoInfo, EspanderError> {
    detector::detect_espanso().await
}

#[tauri::command]
pub async fn generate_yaml(db: State<'_, Database>) -> Result<(), EspanderError> {
    let snippets = db.get_snippets().await?;
    yaml_generator::generate_yaml_files(&snippets, &db.yaml_dir).await?;

    let active_categories: Vec<String> = snippets.iter().map(|s| s.category_id.clone()).collect();
    let mut unique: Vec<String> = Vec::new();
    for c in active_categories {
        if !unique.contains(&c) {
            unique.push(c);
        }
    }
    yaml_generator::cleanup_old_yaml(&db.yaml_dir, &unique).await?;
    Ok(())
}

#[tauri::command]
pub async fn deploy_and_reload(db: State<'_, Database>) -> Result<(), EspanderError> {
    deploy_and_reload_inner(&db).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::database::Database;
    use crate::db::schema::CreateSnippetInput;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_deploy_generates_yaml() {
        let dir = tempdir().unwrap();
        let espanso_config = tempdir().unwrap();

        // Set up database with mock espanso config
        {
            let db = Database::new(dir.path().join(".espander"));
            db.init().await.unwrap();

            // Simulate having espanso config in settings
            let patch = serde_json::json!({
                "espanso_path": "/usr/bin/true",
                "espanso_config_dir": espanso_config.path(),
                "auto_reload": false,
            });
            db.update_settings(patch).await.unwrap();

            // Create a category
            db.create_category("Test Cat".to_string()).await.unwrap();

            // Create a snippet
            let input = CreateSnippetInput {
                trigger: ":test".to_string(),
                replace: "hello world".to_string(),
                category_id: Some("test-cat".to_string()),
                description: None,
                tags: None,
                source: None,
                is_protected: false,
            };
            db.create_snippet(input).await.unwrap();

            // Run deploy
            deploy_and_reload_inner(&db).await.unwrap();
        }

        // Check YAML was generated in our yaml dir
        let yaml_dir = dir.path().join(".espander").join("yaml");
        let yaml_path = yaml_dir.join("test-cat.yml");
        assert!(
            yaml_path.exists(),
            "YAML file should exist at {:?}",
            yaml_path
        );

        let yaml_content = std::fs::read_to_string(&yaml_path).unwrap();
        assert!(
            yaml_content.contains(":test"),
            "YAML should contain trigger"
        );
        assert!(
            yaml_content.contains("hello world"),
            "YAML should contain replace"
        );

        // Check YAML was deployed to espanso match dir
        let espanso_match = espanso_config.path().join("match").join("espander");
        let deployed = espanso_match.join("test-cat.yml");
        assert!(
            deployed.exists(),
            "Deployed file should exist at {:?}",
            deployed
        );
        let deployed_content = std::fs::read_to_string(&deployed).unwrap();
        assert_eq!(
            yaml_content, deployed_content,
            "Deployed YAML should match generated YAML"
        );

        eprintln!("test_deploy_generates_yaml: PASSED");
    }

    #[tokio::test]
    async fn test_deploy_removes_orphaned_files() {
        let dir = tempdir().unwrap();
        let espanso_config = tempdir().unwrap();

        // Create a snippet in category "old-cat"
        {
            let db = Database::new(dir.path().join(".espander"));
            db.init().await.unwrap();
            let patch = serde_json::json!({
                "espanso_path": "/usr/bin/true",
                "espanso_config_dir": espanso_config.path(),
                "auto_reload": false,
            });
            db.update_settings(patch).await.unwrap();

            // Create a category
            db.create_category("Old Cat".to_string()).await.unwrap();

            let input = CreateSnippetInput {
                trigger: ":old".to_string(),
                replace: "old data".to_string(),
                category_id: Some("old-cat".to_string()),
                description: None,
                tags: None,
                source: None,
                is_protected: false,
            };
            db.create_snippet(input).await.unwrap();

            // Deploy — should create old-cat.yml
            deploy_and_reload_inner(&db).await.unwrap();
        }

        let yaml_dir = dir.path().join(".espander").join("yaml");
        let espanso_match = espanso_config.path().join("match").join("espander");
        let old_yaml = yaml_dir.join("old-cat.yml");
        let old_deployed = espanso_match.join("old-cat.yml");
        assert!(old_yaml.exists(), "old-cat.yml should exist in yaml dir");
        assert!(
            old_deployed.exists(),
            "old-cat.yml should exist in espanso match dir"
        );

        // Now delete the snippet (simulate by replacing_all_snippets with empty)
        {
            let db = Database::new(dir.path().join(".espander"));
            db.replace_all_snippets(vec![]).await.unwrap();

            // Deploy again — should remove old-cat.yml from both dirs
            deploy_and_reload_inner(&db).await.unwrap();
        }

        assert!(
            !old_yaml.exists(),
            "old-cat.yml should be removed from yaml dir after deletion"
        );
        assert!(
            !old_deployed.exists(),
            "old-cat.yml should be removed from espanso match dir after deletion"
        );

        eprintln!("test_deploy_removes_orphaned_files: PASSED");
    }
}

/// Helper: generate YAML, deploy to Espanso, reload. Used by CRUD commands.
pub async fn deploy_and_reload_inner(db: &Database) -> Result<DeployOutcome, EspanderError> {
    let snippets = db.get_snippets().await?;

    // Generate YAML files
    yaml_generator::generate_yaml_files(&snippets, &db.yaml_dir).await?;

    // Clean up orphaned YAML files from our yaml dir
    let active_categories: Vec<String> = {
        let mut cats: Vec<String> = snippets.iter().map(|s| s.category_id.clone()).collect();
        cats.sort();
        cats.dedup();
        cats
    };
    yaml_generator::cleanup_old_yaml(&db.yaml_dir, &active_categories).await?;

    // Deploy to Espanso. If the user installed Espanso after first launch, detect it here too.
    let mut settings = db.get_settings().await?;
    if settings.espanso_config_dir.is_none() || settings.espanso_path.is_none() {
        if let Ok(info) = detector::detect_espanso().await {
            if info.found {
                let patch = serde_json::json!({
                    "espanso_path": info.path,
                    "espanso_config_dir": info.config_dir,
                    "espanso_auto_detected": true,
                });
                settings = db.update_settings(patch).await?;
            }
        }
    }

    if let Some(config_dir) = settings.espanso_config_dir.clone() {
        let config_dir = std::path::PathBuf::from(&config_dir);
        let stats = crate::espanso::reloader::deploy_yaml_to_espanso(&db.yaml_dir, &config_dir).await?;

        return Ok(DeployOutcome {
            created: stats.created,
            updated: stats.updated,
            unchanged: stats.unchanged,
            removed: stats.removed,
        });
    } else {
        return Err(EspanderError::EspansoNotFound(
            "Espanso config folder was not found. Open Settings and set the Espanso config path."
                .to_string(),
        ));
    }

}
