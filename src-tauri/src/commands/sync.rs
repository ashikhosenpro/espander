use tauri::State;

use crate::db::database::Database;
use crate::db::schema::{DeviceFlowResponse, OAuthResult, SyncResult};
use crate::error::EspanderError;
use crate::github::oauth;

#[tauri::command]
pub async fn sync_now(db: State<'_, Database>) -> Result<SyncResult, EspanderError> {
    let settings = db.get_settings().await?;
    let provider_type = settings.sync_provider;

    match provider_type.as_str() {
        "local" => {
            let deploy = crate::commands::espanso::deploy_and_reload_inner(&db).await?;
            Ok(SyncResult {
                success: true,
                snippets_pulled: 0,
                snippets_pushed: 0,
                conflicts: 0,
                message: deploy.message("Local mode:"),
            })
        }
        "gsheet" => {
            let csv_url = settings.gsheet_csv_url.ok_or_else(|| {
                EspanderError::SyncFailed(
                    "No Google Sheets URL configured. Set it in Settings.".to_string(),
                )
            })?;

            let result_res = crate::commands::gsheet::import_from_gsheet_url(&*db, &csv_url).await;

            let mut sync_meta: crate::db::schema::SyncMeta = db
                .read_json(&db.sync_path)
                .await
                .unwrap_or_else(|_| crate::db::schema::SyncMeta {
                    version: 1,
                    provider: "gsheet".to_string(),
                    last_sync_at: None,
                    last_sync_status: "never".to_string(),
                    last_sync_error: None,
                    is_syncing: false,
                    sync_history: Vec::new(),
                    github: None,
                    gsheet: None,
                });
            let now = chrono::Utc::now();

            match result_res {
                Ok(result) => {
                    let deploy = crate::commands::espanso::deploy_and_reload_inner(&db).await?;
                    let import_message = if result.imported == 0 {
                        "Everything is already synchronized. No new snippets were found."
                            .to_string()
                    } else {
                        format!(
                            "Imported {} snippets{}",
                            result.imported,
                            if !result.errors.is_empty() {
                                format!(" ({} errors)", result.errors.len())
                            } else {
                                String::new()
                            }
                        )
                    };
                    sync_meta.last_sync_at = Some(now);
                    sync_meta.last_sync_status = "success".to_string();
                    sync_meta.last_sync_error = None;
                    sync_meta.sync_history.push(crate::db::schema::SyncEvent {
                        timestamp: now,
                        status: "success".to_string(),
                        snippets_pulled: result.imported,
                        snippets_pushed: 0,
                        conflicts: 0,
                    });
                    if sync_meta.sync_history.len() > 20 {
                        sync_meta.sync_history.remove(0);
                    }
                    let _ = db.write_json(&db.sync_path, &sync_meta).await;

                    Ok(SyncResult {
                        success: true,
                        snippets_pulled: result.imported,
                        snippets_pushed: 0,
                        conflicts: 0,
                        message: format!("{} {}", import_message, deploy.message("Espanso:")),
                    })
                }
                Err(err) => {
                    let err_msg = err.to_string();
                    sync_meta.last_sync_status = "error".to_string();
                    sync_meta.last_sync_error = Some(err_msg.clone());
                    sync_meta.sync_history.push(crate::db::schema::SyncEvent {
                        timestamp: now,
                        status: "error".to_string(),
                        snippets_pulled: 0,
                        snippets_pushed: 0,
                        conflicts: 0,
                    });
                    if sync_meta.sync_history.len() > 20 {
                        sync_meta.sync_history.remove(0);
                    }
                    let _ = db.write_json(&db.sync_path, &sync_meta).await;
                    Err(err)
                }
            }
        }
        "github" => {
            let result_res = crate::github_sync::run_github_sync(&db).await;

            let mut sync_meta: crate::db::schema::SyncMeta = db
                .read_json(&db.sync_path)
                .await
                .unwrap_or_else(|_| crate::db::schema::SyncMeta {
                    version: 1,
                    provider: "github".to_string(),
                    last_sync_at: None,
                    last_sync_status: "never".to_string(),
                    last_sync_error: None,
                    is_syncing: false,
                    sync_history: Vec::new(),
                    github: None,
                    gsheet: None,
                });
            let now = chrono::Utc::now();

            match result_res {
                Ok(result) => {
                    let deploy = crate::commands::espanso::deploy_and_reload_inner(&db).await?;
                    sync_meta.last_sync_at = Some(now);
                    sync_meta.last_sync_status = "success".to_string();
                    sync_meta.last_sync_error = None;
                    sync_meta.sync_history.push(crate::db::schema::SyncEvent {
                        timestamp: now,
                        status: "success".to_string(),
                        snippets_pulled: result.snippets_pulled,
                        snippets_pushed: result.snippets_pushed,
                        conflicts: result.conflicts,
                    });
                    if sync_meta.sync_history.len() > 20 {
                        sync_meta.sync_history.remove(0);
                    }
                    let _ = db.write_json(&db.sync_path, &sync_meta).await;
                    Ok(SyncResult {
                        success: result.success,
                        snippets_pulled: result.snippets_pulled,
                        snippets_pushed: result.snippets_pushed,
                        conflicts: result.conflicts,
                        message: format!("{} {}", result.message, deploy.message("Espanso:")),
                    })
                }
                Err(err) => {
                    let err_msg = err.to_string();
                    sync_meta.last_sync_status = "error".to_string();
                    sync_meta.last_sync_error = Some(err_msg.clone());
                    sync_meta.sync_history.push(crate::db::schema::SyncEvent {
                        timestamp: now,
                        status: "error".to_string(),
                        snippets_pulled: 0,
                        snippets_pushed: 0,
                        conflicts: 0,
                    });
                    if sync_meta.sync_history.len() > 20 {
                        sync_meta.sync_history.remove(0);
                    }
                    let _ = db.write_json(&db.sync_path, &sync_meta).await;
                    Err(err)
                }
            }
        }
        _ => Err(EspanderError::SyncFailed(
            "Unknown sync provider".to_string(),
        )),
    }
}

#[tauri::command]
pub async fn get_sync_status(db: State<'_, Database>) -> Result<serde_json::Value, EspanderError> {
    let sync_meta: crate::db::schema::SyncMeta = db.read_json(&db.sync_path).await?;
    Ok(serde_json::to_value(&sync_meta)?)
}

#[tauri::command]
pub async fn start_github_oauth() -> Result<DeviceFlowResponse, EspanderError> {
    oauth::start_device_flow().await
}

#[tauri::command]
pub async fn poll_github_oauth(
    device_code: String,
    interval: u32,
) -> Result<OAuthResult, EspanderError> {
    oauth::poll_for_token(&device_code, interval).await
}

#[derive(serde::Serialize)]
pub struct TestConnectionResult {
    pub success: bool,
    pub message: String,
    pub default_branch: Option<String>,
}

#[tauri::command]
pub async fn test_github_connection(
    repo_url: String,
    token: String,
) -> Result<TestConnectionResult, EspanderError> {
    let cleaned_url = repo_url.trim();
    if cleaned_url.is_empty() {
        return Ok(TestConnectionResult {
            success: false,
            message: "Step 1 Failed: Repository URL is empty. Please enter a valid URL (e.g. https://github.com/owner/repo).".to_string(),
            default_branch: None,
        });
    }

    let parsed = crate::github_sync::parse_github_url(cleaned_url);
    let (owner, repo) = match parsed {
        Some((o, r)) => (o, r),
        None => {
            return Ok(TestConnectionResult {
                success: false,
                message: "Step 2 Failed: Could not parse Owner and Repository Name from the URL. Please verify the URL format (e.g., https://github.com/owner/repo).".to_string(),
                default_branch: None,
            });
        }
    };

    let client = reqwest::Client::new();

    let token_val = if token.starts_with("github_pat_••••") || token == "SECURE_TOKEN_SET" {
        crate::db::settings::get_secure_token().unwrap_or_default()
    } else {
        token.clone()
    };

    if token_val.is_empty() {
        return Ok(TestConnectionResult {
            success: false,
            message: "Step 3 Failed: Token is empty or invalid. Please provide a valid Fine-grained Personal Access Token.".to_string(),
            default_branch: None,
        });
    }

    let user_resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token_val))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Espander-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await;

    let user_status = match user_resp {
        Ok(resp) => resp.status(),
        Err(e) => {
            return Ok(TestConnectionResult {
                success: false,
                message: format!("Step 3 Failed: Network error verifying token: {}. Check your internet connection.", e),
                default_branch: None,
            });
        }
    };

    if !user_status.is_success() {
        return Ok(TestConnectionResult {
            success: false,
            message: format!("Step 3 Failed: The Personal Access Token is invalid or expired (GitHub returned HTTP status {}).", user_status),
            default_branch: None,
        });
    }

    let repo_resp = client
        .get(format!("https://api.github.com/repos/{}/{}", owner, repo))
        .header("Authorization", format!("Bearer {}", token_val))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Espander-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await;

    let repo_resp_obj = match repo_resp {
        Ok(resp) => resp,
        Err(e) => {
            return Ok(TestConnectionResult {
                success: false,
                message: format!(
                    "Step 4 Failed: Network error checking repository access: {}.",
                    e
                ),
                default_branch: None,
            });
        }
    };

    let repo_status = repo_resp_obj.status();
    if repo_status == reqwest::StatusCode::NOT_FOUND {
        return Ok(TestConnectionResult {
            success: false,
            message: format!("Step 4 Failed: Repository '{}' not found for owner '{}'. Verify that the repository exists, is spelled correctly, and the token has access permissions.", repo, owner),
            default_branch: None,
        });
    } else if !repo_status.is_success() {
        return Ok(TestConnectionResult {
            success: false,
            message: format!("Step 4 Failed: Repository access validation failed (GitHub returned HTTP status {}).", repo_status),
            default_branch: None,
        });
    }

    #[derive(serde::Deserialize)]
    struct RepositoryResponse {
        default_branch: Option<String>,
    }

    let repo_json = repo_resp_obj.json::<RepositoryResponse>().await.ok();
    let detected_branch = repo_json
        .and_then(|r| r.default_branch)
        .unwrap_or_else(|| "main".to_string());

    let branch_resp = client
        .get(format!(
            "https://api.github.com/repos/{}/{}/branches/{}",
            owner, repo, detected_branch
        ))
        .header("Authorization", format!("Bearer {}", token_val))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Espander-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await;

    let branch_status = match branch_resp {
        Ok(resp) => resp.status(),
        Err(e) => {
            return Ok(TestConnectionResult {
                success: false,
                message: format!(
                    "Step 5 Failed: Network error checking default branch '{}' existence: {}.",
                    detected_branch, e
                ),
                default_branch: None,
            });
        }
    };

    let is_empty_repo = branch_status == reqwest::StatusCode::NOT_FOUND;
    if !is_empty_repo && !branch_status.is_success() {
        return Ok(TestConnectionResult {
            success: false,
            message: format!("Step 5 Failed: Branch validation failed for default branch '{}' (GitHub returned HTTP status {}).", detected_branch, branch_status),
            default_branch: None,
        });
    }

    let temp_test_path = "snippets/.connection_test";
    let check_resp = client
        .get(format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, temp_test_path
        ))
        .header("Authorization", format!("Bearer {}", token_val))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Espander-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .query(&[("ref", &detected_branch)])
        .send()
        .await;

    let mut existing_sha = None;
    if let Ok(resp) = check_resp {
        if resp.status().is_success() {
            #[derive(serde::Deserialize)]
            struct FileSha {
                sha: String,
            }
            if let Ok(obj) = resp.json::<FileSha>().await {
                existing_sha = Some(obj.sha);
            }
        }
    }

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let test_content = STANDARD.encode("Espander connection test successful.");

    let put_payload = serde_json::json!({
        "message": "Verify connection permissions",
        "content": test_content,
        "sha": existing_sha,
        "branch": detected_branch
    });

    let put_resp = client
        .put(format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, temp_test_path
        ))
        .header("Authorization", format!("Bearer {}", token_val))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Espander-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&put_payload)
        .send()
        .await;

    let put_resp_obj = match put_resp {
        Ok(resp) => resp,
        Err(e) => {
            return Ok(TestConnectionResult {
                success: false,
                message: format!(
                    "Step 8 Failed: Network error verifying write permissions: {}.",
                    e
                ),
                default_branch: None,
            });
        }
    };

    let put_status = put_resp_obj.status();
    if !put_status.is_success() {
        let err_body = put_resp_obj.text().await.unwrap_or_default();
        let message = if is_empty_repo {
            format!("Step 8 Failed: Write verification failed on a fresh/empty repository. Make sure your Fine-grained PAT has 'Contents: Read & Write' permission and has select access to this specific repository. GitHub returned status {}: {}", put_status, err_body)
        } else {
            format!("Step 8 Failed: Write verification failed. Make sure your Fine-grained PAT has 'Contents: Read & Write' permission. GitHub returned status {}: {}", put_status, err_body)
        };
        return Ok(TestConnectionResult {
            success: false,
            message,
            default_branch: None,
        });
    }

    #[derive(serde::Deserialize)]
    struct PutContentResponse {
        content: Option<PutContentItem>,
    }
    #[derive(serde::Deserialize)]
    struct PutContentItem {
        sha: String,
    }

    let put_json = put_resp_obj.json::<PutContentResponse>().await.ok();
    let new_sha = put_json.and_then(|j| j.content).map(|c| c.sha);

    if let Some(sha_to_delete) = new_sha {
        let del_payload = serde_json::json!({
            "message": "Cleanup connection test file",
            "sha": sha_to_delete,
            "branch": detected_branch
        });

        let _ = client
            .delete(format!(
                "https://api.github.com/repos/{}/{}/contents/{}",
                owner, repo, temp_test_path
            ))
            .header("Authorization", format!("Bearer {}", token_val))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Espander-App")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&del_payload)
            .send()
            .await;
    }

    Ok(TestConnectionResult {
        success: true,
        message: format!("Connection Test Successful! All checks passed: valid URL, authenticated token, correct repository, active branch '{}', and full read/write permissions verified.", detected_branch),
        default_branch: Some(detected_branch),
    })
}
