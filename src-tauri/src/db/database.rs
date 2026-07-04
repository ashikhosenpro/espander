use std::path::PathBuf;
use tokio::fs;

use crate::error::EspanderError;

pub struct Database {
    pub base_dir: PathBuf,
    pub snippets_path: PathBuf,
    pub categories_path: PathBuf,
    pub settings_path: PathBuf,
    pub sync_path: PathBuf,
    pub yaml_dir: PathBuf,
    pub backup_dir: PathBuf,
}

impl Database {
    pub fn new(base_dir: PathBuf) -> Self {
        let database_dir = base_dir.join("database");
        let yaml_dir = base_dir.join("yaml");
        let backup_dir = base_dir.join("backup");

        Self {
            snippets_path: database_dir.join("snippets.json"),
            categories_path: database_dir.join("categories.json"),
            settings_path: database_dir.join("settings.json"),
            sync_path: database_dir.join("sync.json"),
            yaml_dir,
            backup_dir,
            base_dir,
        }
    }

    pub async fn init(&self) -> Result<(), EspanderError> {
        fs::create_dir_all(self.base_dir.join("database")).await?;
        fs::create_dir_all(&self.yaml_dir).await?;
        fs::create_dir_all(&self.backup_dir).await?;
        fs::create_dir_all(self.base_dir.join("logs")).await?;

        if !file_exists(&self.snippets_path).await {
            let default = r#"{"version":1,"snippets":[]}"#;
            fs::write(&self.snippets_path, default).await?;
        }
        if !file_exists(&self.categories_path).await {
            let default_cats = super::categories::default_categories();
            let file = crate::db::schema::CategoryFile {
                version: 1,
                categories: default_cats,
            };
            let default = serde_json::to_string_pretty(&file)?;
            fs::write(&self.categories_path, default).await?;
        }
        if !file_exists(&self.settings_path).await {
            let settings = serde_json::json!({
                "version": 1,
                "theme": "dark",
                "language": "en",
                "espanso_path": null,
                "espanso_config_dir": null,
                "espanso_auto_detected": false,
                "sync_provider": "local",
                "sync_interval_minutes": 60,
                "auto_sync": true,
                "auto_reload": true,
                "first_launch_complete": false,
            });
            fs::write(
                &self.settings_path,
                serde_json::to_string_pretty(&settings)?,
            )
            .await?;
        }
        if !file_exists(&self.sync_path).await {
            let sync = serde_json::json!({
                "version": 1,
                "provider": "local",
                "last_sync_at": null,
                "last_sync_status": "never",
                "last_sync_error": null,
                "is_syncing": false,
                "sync_history": [],
                "github": null,
                "gsheet": null
            });
            fs::write(&self.sync_path, serde_json::to_string_pretty(&sync)?).await?;
        }
        Ok(())
    }

    pub async fn read_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &std::path::Path,
    ) -> Result<T, EspanderError> {
        let data = fs::read_to_string(path).await?;
        Ok(serde_json::from_str(&data)?)
    }

    pub async fn write_json<T: serde::Serialize>(
        &self,
        path: &std::path::Path,
        value: &T,
    ) -> Result<(), EspanderError> {
        let data = serde_json::to_string_pretty(value)?;
        fs::write(path, data).await?;
        Ok(())
    }
}

async fn file_exists(path: &std::path::Path) -> bool {
    fs::try_exists(path).await.unwrap_or(false)
}
