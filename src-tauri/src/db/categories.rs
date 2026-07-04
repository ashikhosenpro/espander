use chrono::Utc;

use super::database::Database;
use super::schema::*;
use crate::error::EspanderError;

impl Database {
    pub async fn get_categories(&self) -> Result<Vec<Category>, EspanderError> {
        let mut file: CategoryFile = self.read_json(&self.categories_path).await?;

        // Ensure the Global category always exists
        if !file.categories.iter().any(|c| c.id == "global") {
            file.categories.push(Category {
                id: "global".to_string(),
                name: "Global".to_string(),
                icon: "folder".to_string(),
                color: "#6366f1".to_string(),
                sort_order: 0,
                created_at: Utc::now(),
            });
            let _ = self.write_json(&self.categories_path, &file).await;
        }

        let mut cats = file.categories;
        cats.sort_by_key(|c| c.sort_order);
        Ok(cats)
    }

    pub async fn create_category(&self, name: String) -> Result<Category, EspanderError> {
        let mut file: CategoryFile = self.read_json(&self.categories_path).await?;
        let id = name.to_lowercase().replace(' ', "-");

        let max_order = file
            .categories
            .iter()
            .map(|c| c.sort_order)
            .max()
            .unwrap_or(0);
        let category = Category {
            id: id.clone(),
            name,
            icon: "folder".to_string(),
            color: "#6366f1".to_string(),
            sort_order: max_order + 1,
            created_at: Utc::now(),
        };

        file.categories.push(category.clone());
        self.write_json(&self.categories_path, &file).await?;
        Ok(category)
    }

    pub async fn update_category(&self, id: &str, name: String) -> Result<Category, EspanderError> {
        let mut file: CategoryFile = self.read_json(&self.categories_path).await?;
        let category = file
            .categories
            .iter_mut()
            .find(|c| c.id == id)
            .ok_or_else(|| EspanderError::Database(format!("Category {} not found", id)))?;
        if !name.trim().is_empty() {
            category.name = name.trim().to_string();
        }
        let result = category.clone();
        self.write_json(&self.categories_path, &file).await?;
        Ok(result)
    }

    pub async fn reorder_categories(
        &self,
        ids: Vec<String>,
    ) -> Result<Vec<Category>, EspanderError> {
        let mut file: CategoryFile = self.read_json(&self.categories_path).await?;
        let mut reordered: Vec<Category> = ids
            .iter()
            .filter_map(|id| file.categories.iter().find(|c| c.id == *id).cloned())
            .collect();
        for (i, cat) in reordered.iter_mut().enumerate() {
            cat.sort_order = i as u32;
        }
        file.categories = reordered.clone();
        self.write_json(&self.categories_path, &file).await?;
        Ok(reordered)
    }

    pub async fn delete_category(
        &self,
        id: &str,
        delete_snippets: bool,
    ) -> Result<(), EspanderError> {
        if id == "global" {
            return Err(EspanderError::Database(
                "The Global category cannot be deleted.".to_string(),
            ));
        }

        let mut snippets_file: SnippetFile = self.read_json(&self.snippets_path).await?;
        let count = snippets_file
            .snippets
            .iter()
            .filter(|s| s.category_id == id)
            .count();
        if count > 0 {
            if delete_snippets {
                snippets_file.snippets.retain(|s| s.category_id != id);
                self.write_json(&self.snippets_path, &snippets_file).await?;
            } else {
                return Err(EspanderError::Database(format!(
                    "CONTAINS_SNIPPETS:{}",
                    count
                )));
            }
        }

        let mut file: CategoryFile = self.read_json(&self.categories_path).await?;
        file.categories.retain(|c| c.id != id);
        self.write_json(&self.categories_path, &file).await?;
        Ok(())
    }
}

pub fn default_categories() -> Vec<Category> {
    let now = Utc::now();
    vec![
        Category {
            id: "personal".to_string(),
            name: "Personal".to_string(),
            icon: "user".to_string(),
            color: "#6366f1".to_string(),
            sort_order: 0,
            created_at: now,
        },
        Category {
            id: "coding".to_string(),
            name: "Coding".to_string(),
            icon: "code".to_string(),
            color: "#10b981".to_string(),
            sort_order: 1,
            created_at: now,
        },
        Category {
            id: "work".to_string(),
            name: "Work".to_string(),
            icon: "briefcase".to_string(),
            color: "#f59e0b".to_string(),
            sort_order: 2,
            created_at: now,
        },
        Category {
            id: "clients".to_string(),
            name: "Clients".to_string(),
            icon: "building".to_string(),
            color: "#ec4899".to_string(),
            sort_order: 3,
            created_at: now,
        },
        Category {
            id: "ai".to_string(),
            name: "AI Prompts".to_string(),
            icon: "sparkles".to_string(),
            color: "#8b5cf6".to_string(),
            sort_order: 4,
            created_at: now,
        },
        Category {
            id: "imported".to_string(),
            name: "Imported".to_string(),
            icon: "download".to_string(),
            color: "#64748b".to_string(),
            sort_order: 99,
            created_at: now,
        },
    ]
}
