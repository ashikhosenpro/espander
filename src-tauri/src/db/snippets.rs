use chrono::Utc;
use uuid::Uuid;

use super::database::Database;
use super::schema::*;
use crate::error::EspanderError;

impl Database {
    pub async fn get_snippets(&self) -> Result<Vec<Snippet>, EspanderError> {
        let file: SnippetFile = self.read_json(&self.snippets_path).await?;
        Ok(file.snippets)
    }

    pub async fn create_snippet(
        &self,
        input: CreateSnippetInput,
    ) -> Result<Snippet, EspanderError> {
        if input.trigger.len() > 200 {
            return Err(EspanderError::Database(
                "Trigger too long (max 200 chars)".to_string(),
            ));
        }
        if input.replace.len() > 10000 {
            return Err(EspanderError::Database(
                "Replacement too long (max 10000 chars)".to_string(),
            ));
        }
        if let Some(ref desc) = input.description {
            if desc.len() > 500 {
                return Err(EspanderError::Database(
                    "Description too long (max 500 chars)".to_string(),
                ));
            }
        }

        let mut file: SnippetFile = self.read_json(&self.snippets_path).await?;

        if file
            .snippets
            .iter()
            .any(|s| s.trigger.to_lowercase() == input.trigger.to_lowercase())
        {
            return Err(EspanderError::Database(format!(
                "Snippet with trigger '{}' already exists",
                input.trigger
            )));
        }

        let now = Utc::now();
        let snippet = Snippet {
            id: Uuid::new_v4().to_string(),
            trigger: input.trigger,
            replace: input.replace,
            category_id: {
                let cat_id = input.category_id.unwrap_or_else(|| "global".to_string());
                let categories_file: CategoryFile = self
                    .read_json(&self.categories_path)
                    .await
                    .unwrap_or(CategoryFile {
                        version: 1,
                        categories: Vec::new(),
                    });
                if categories_file.categories.iter().any(|c| c.id == cat_id) {
                    cat_id
                } else {
                    "global".to_string()
                }
            },
            description: input.description.unwrap_or_default(),
            notes: input.notes,
            tags: input.tags.unwrap_or_default(),
            is_favorite: false,
            is_paused: false,
            is_protected: input.is_protected,
            source: input.source.unwrap_or_else(|| "local".to_string()),
            created_at: now,
            updated_at: now,
            sync_status: SyncStatus::Local,
        };

        file.snippets.push(snippet.clone());
        self.write_json(&self.snippets_path, &file).await?;
        Ok(snippet)
    }

    pub async fn update_snippet(
        &self,
        id: &str,
        input: UpdateSnippetInput,
    ) -> Result<Snippet, EspanderError> {
        if let Some(ref replace) = input.replace {
            if replace.len() > 10000 {
                return Err(EspanderError::Database(
                    "Replacement too long (max 10000 chars)".to_string(),
                ));
            }
        }
        if let Some(ref description) = input.description {
            if description.len() > 500 {
                return Err(EspanderError::Database(
                    "Description too long (max 500 chars)".to_string(),
                ));
            }
        }

        let mut file: SnippetFile = self.read_json(&self.snippets_path).await?;

        if let Some(ref trigger) = input.trigger {
            if trigger.len() > 200 {
                return Err(EspanderError::Database(
                    "Trigger too long (max 200 chars)".to_string(),
                ));
            }
            if file
                .snippets
                .iter()
                .any(|s| s.id != id && s.trigger.to_lowercase() == trigger.to_lowercase())
            {
                return Err(EspanderError::Database(format!(
                    "Snippet with trigger '{}' already exists",
                    trigger
                )));
            }
        }

        let snippet = file
            .snippets
            .iter_mut()
            .find(|s| s.id == id)
            .ok_or_else(|| EspanderError::Database(format!("Snippet {} not found", id)))?;

        if let Some(trigger) = input.trigger {
            snippet.trigger = trigger;
        }
        if let Some(replace) = input.replace {
            snippet.replace = replace;
        }
        if let Some(category_id) = input.category_id {
            let categories_file: CategoryFile = self
                .read_json(&self.categories_path)
                .await
                .unwrap_or(CategoryFile {
                    version: 1,
                    categories: Vec::new(),
                });
            let final_cat_id = if categories_file
                .categories
                .iter()
                .any(|c| c.id == category_id)
            {
                category_id
            } else {
                "global".to_string()
            };
            snippet.category_id = final_cat_id;
        }
        if let Some(description) = input.description {
            snippet.description = description;
        }
        if let Some(notes) = input.notes {
            snippet.notes = if notes.trim().is_empty() { None } else { Some(notes) };
        }
        if let Some(tags) = input.tags {
            snippet.tags = tags;
        }
        if let Some(is_favorite) = input.is_favorite {
            snippet.is_favorite = is_favorite;
        }
        if let Some(is_paused) = input.is_paused {
            snippet.is_paused = is_paused;
        }
        if let Some(is_protected) = input.is_protected {
            snippet.is_protected = is_protected;
        }
        snippet.updated_at = Utc::now();
        if snippet.sync_status == SyncStatus::Synced {
            snippet.sync_status = SyncStatus::Modified;
        }

        let result = snippet.clone();
        self.write_json(&self.snippets_path, &file).await?;
        Ok(result)
    }

    pub async fn delete_snippet(&self, id: &str) -> Result<(), EspanderError> {
        let mut file: SnippetFile = self.read_json(&self.snippets_path).await?;
        let len_before = file.snippets.len();
        file.snippets.retain(|s| s.id != id);
        if file.snippets.len() == len_before {
            return Err(EspanderError::Database(format!("Snippet {} not found", id)));
        }
        self.write_json(&self.snippets_path, &file).await?;
        Ok(())
    }

    pub async fn bulk_delete_snippets(&self, ids: &[String]) -> Result<(), EspanderError> {
        let mut file: SnippetFile = self.read_json(&self.snippets_path).await?;
        file.snippets.retain(|s| !ids.contains(&s.id));
        self.write_json(&self.snippets_path, &file).await?;
        Ok(())
    }

    pub async fn bulk_move_snippets(
        &self,
        ids: &[String],
        category_id: &str,
    ) -> Result<(), EspanderError> {
        let mut file: SnippetFile = self.read_json(&self.snippets_path).await?;
        for snippet in file.snippets.iter_mut() {
            if ids.contains(&snippet.id) {
                snippet.category_id = category_id.to_string();
                snippet.updated_at = Utc::now();
                if snippet.sync_status == SyncStatus::Synced {
                    snippet.sync_status = SyncStatus::Modified;
                }
            }
        }
        self.write_json(&self.snippets_path, &file).await?;
        Ok(())
    }

    pub async fn duplicate_snippet(&self, id: &str) -> Result<Snippet, EspanderError> {
        let file: SnippetFile = self.read_json(&self.snippets_path).await?;
        let original = file
            .snippets
            .iter()
            .find(|s| s.id == id)
            .ok_or_else(|| EspanderError::Database(format!("Snippet {} not found", id)))?;

        let now = Utc::now();
        let duplicate = Snippet {
            id: Uuid::new_v4().to_string(),
            trigger: format!("{}-copy", original.trigger),
            replace: original.replace.clone(),
            category_id: original.category_id.clone(),
            description: original.description.clone(),
            notes: original.notes.clone(),
            tags: original.tags.clone(),
            is_favorite: false,
            is_paused: false,
            is_protected: original.is_protected,
            source: original.source.clone(),
            created_at: now,
            updated_at: now,
            sync_status: SyncStatus::Local,
        };

        let mut file: SnippetFile = self.read_json(&self.snippets_path).await?;
        file.snippets.push(duplicate.clone());
        self.write_json(&self.snippets_path, &file).await?;
        Ok(duplicate)
    }

    pub async fn toggle_snippet_favorite(&self, id: &str) -> Result<Snippet, EspanderError> {
        let mut file: SnippetFile = self.read_json(&self.snippets_path).await?;
        let snippet = file
            .snippets
            .iter_mut()
            .find(|s| s.id == id)
            .ok_or_else(|| EspanderError::Database(format!("Snippet {} not found", id)))?;

        snippet.is_favorite = !snippet.is_favorite;
        snippet.updated_at = Utc::now();

        let result = snippet.clone();
        self.write_json(&self.snippets_path, &file).await?;
        Ok(result)
    }

    pub async fn replace_all_snippets(&self, snippets: Vec<Snippet>) -> Result<(), EspanderError> {
        let file = SnippetFile {
            version: 1,
            snippets,
        };
        self.write_json(&self.snippets_path, &file).await?;
        Ok(())
    }
}
