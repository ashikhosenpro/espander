use super::database::Database;
use super::schema::Settings;
use crate::error::EspanderError;
use keyring::Entry;

const GITHUB_TOKEN_SERVICE: &str = "com.ashikhosen.espander";
const GITHUB_TOKEN_ACCOUNT: &str = "github_token";

pub fn set_secure_token(token: &str) -> Result<(), String> {
    let entry =
        Entry::new(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT).map_err(|e| e.to_string())?;
    entry.set_password(token).map_err(|e| e.to_string())
}

pub fn get_secure_token() -> Option<String> {
    Entry::new(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT)
        .ok()
        .and_then(|entry| entry.get_password().ok())
}

pub fn delete_secure_token() -> Result<(), String> {
    let entry =
        Entry::new(GITHUB_TOKEN_SERVICE, GITHUB_TOKEN_ACCOUNT).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn masked_token_for_settings(stored_token: &str, secure_token_available: bool) -> Option<String> {
    let uses_secure_storage =
        stored_token == "SECURE_TOKEN_SET" || stored_token.starts_with("github_pat_••••");
    if uses_secure_storage && !secure_token_available {
        None
    } else {
        Some("github_pat_••••••••".to_string())
    }
}

impl Database {
    pub async fn get_settings(&self) -> Result<Settings, EspanderError> {
        let mut settings: Settings = self.read_json(&self.settings_path).await?;
        if let Some(stored_token) = settings.github_token.as_deref() {
            // Do not report a stale placeholder as an active connection. This
            // lets the UI offer reconnection instead of repeatedly failing only
            // when the user presses Sync.
            settings.github_token =
                masked_token_for_settings(stored_token, get_secure_token().is_some());
        }
        Ok(settings)
    }

    pub async fn update_settings(
        &self,
        patch: serde_json::Value,
    ) -> Result<Settings, EspanderError> {
        let settings: Settings = self.read_json(&self.settings_path).await?;
        let mut current = serde_json::to_value(&settings)?;

        if let Some(obj) = patch.as_object() {
            for (key, value) in obj {
                if key == "github_repo_url" {
                    if let Some(url_str) = value.as_str() {
                        let url_trimmed = url_str.trim();
                        if !url_trimmed.is_empty() {
                            if let Some((owner, repo)) =
                                crate::github_sync::parse_github_url(url_trimmed)
                            {
                                current["github_repo_owner"] = serde_json::Value::String(owner);
                                current["github_repo_name"] = serde_json::Value::String(repo);
                                current["github_repo_url"] =
                                    serde_json::Value::String(url_trimmed.to_string());
                            } else {
                                return Err(EspanderError::Database(
                                    "Invalid GitHub Repository URL format. Expected format: https://github.com/owner/repo".to_string(),
                                ));
                            }
                        } else {
                            current["github_repo_url"] = serde_json::Value::Null;
                            current["github_repo_owner"] = serde_json::Value::Null;
                            current["github_repo_name"] = serde_json::Value::Null;
                        }
                    } else {
                        current["github_repo_url"] = serde_json::Value::Null;
                        current["github_repo_owner"] = serde_json::Value::Null;
                        current["github_repo_name"] = serde_json::Value::Null;
                    }
                } else if key == "github_token" {
                    if let Some(token_str) = value.as_str() {
                        let token_trimmed = token_str.trim();
                        if !token_trimmed.is_empty() {
                            if token_trimmed.starts_with("github_pat_••••")
                                || token_trimmed == "SECURE_TOKEN_SET"
                            {
                                // Do not overwrite with masked/placeholder token
                            } else {
                                set_secure_token(token_trimmed).map_err(|e| {
                                    EspanderError::Database(format!(
                                        "Failed to save token to secure storage: {}",
                                        e
                                    ))
                                })?;
                                current["github_token"] =
                                    serde_json::Value::String("SECURE_TOKEN_SET".to_string());
                            }
                        } else {
                            let _ = delete_secure_token();
                            current["github_token"] = serde_json::Value::Null;
                        }
                    } else {
                        let _ = delete_secure_token();
                        current["github_token"] = serde_json::Value::Null;
                    }
                } else {
                    current[key] = value.clone();
                }
            }
        }

        let updated: Settings = serde_json::from_value(current)?;
        self.write_json(&self.settings_path, &updated).await?;

        let mut returned = updated.clone();
        if returned.github_token.is_some() {
            returned.github_token = Some("github_pat_••••••••".to_string());
        }
        Ok(returned)
    }
}

pub async fn get_settings_from_path() -> Result<Settings, EspanderError> {
    let data_dir = get_app_data_dir().await?;
    let db = Database::new(data_dir);
    db.get_settings().await
}

pub async fn get_app_data_dir() -> Result<std::path::PathBuf, EspanderError> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| EspanderError::Other("Cannot determine home directory".to_string()))?;

    Ok(std::path::PathBuf::from(home).join(".espander"))
}

#[cfg(test)]
mod tests {
    use super::masked_token_for_settings;

    #[test]
    fn stale_secure_token_marker_is_not_reported_as_connected() {
        assert_eq!(masked_token_for_settings("SECURE_TOKEN_SET", false), None);
    }

    #[test]
    fn available_secure_token_is_masked() {
        assert_eq!(
            masked_token_for_settings("SECURE_TOKEN_SET", true).as_deref(),
            Some("github_pat_••••••••")
        );
    }

    #[test]
    fn legacy_plaintext_token_remains_usable_and_masked() {
        assert_eq!(
            masked_token_for_settings("ghp_legacy-token", false).as_deref(),
            Some("github_pat_••••••••")
        );
    }
}
