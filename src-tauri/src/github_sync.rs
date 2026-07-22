use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::db::database::Database;
use crate::db::schema::{Category, CategoryFile, Snippet, SnippetFile, SyncResult, SyncStatus};
use crate::error::EspanderError;

pub fn parse_github_url(url: &str) -> Option<(String, String)> {
    let cleaned = url.trim().trim_end_matches(".git");
    if cleaned.starts_with("https://") {
        let parts: Vec<&str> = cleaned.split('/').collect();
        if parts.len() >= 5 {
            let owner = parts[3].to_string();
            let repo = parts[4].to_string();
            if !owner.is_empty() && !repo.is_empty() {
                return Some((owner, repo));
            }
        }
    } else if cleaned.starts_with("git@github.com:") {
        let parts: Vec<&str> = cleaned
            .trim_start_matches("git@github.com:")
            .split('/')
            .collect();
        if parts.len() >= 2 {
            let owner = parts[0].to_string();
            let repo = parts[1].to_string();
            if !owner.is_empty() && !repo.is_empty() {
                return Some((owner, repo));
            }
        }
    }
    None
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct YamlMatch {
    trigger: String,
    replace: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    is_favorite: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    is_paused: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    is_protected: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct YamlFileContent {
    matches: Vec<YamlMatch>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct GithubContentItem {
    name: String,
    path: String,
    sha: String,
    #[serde(rename = "type")]
    item_type: String,
    download_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct GithubPutUpdatePayload {
    message: String,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    sha: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
}

#[derive(Debug, Serialize)]
struct GithubDeletePayload {
    message: String,
    sha: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
}

pub async fn run_github_sync(db: &Database) -> Result<SyncResult, EspanderError> {
    let settings: crate::db::schema::Settings = db.read_json(&db.settings_path).await?;

    let mut token = settings.github_token.ok_or_else(|| {
        EspanderError::SyncFailed("GitHub authentication token not configured.".to_string())
    })?;
    if token == "SECURE_TOKEN_SET" || token.starts_with("github_pat_••••") {
        token = crate::db::settings::get_secure_token().ok_or_else(|| {
            EspanderError::SyncFailed(
                "GitHub Personal Access Token not found in secure storage.".to_string(),
            )
        })?;
    }
    let owner = settings.github_repo_owner.ok_or_else(|| {
        EspanderError::SyncFailed("GitHub repository owner not configured.".to_string())
    })?;
    let repo = settings.github_repo_name.ok_or_else(|| {
        EspanderError::SyncFailed("GitHub repository name not configured.".to_string())
    })?;
    let branch = settings.github_branch.unwrap_or_else(|| "main".to_string());

    let path_prefix = settings
        .github_path
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| "snippets".to_string());

    let client = reqwest::Client::new();

    // Check if the branch exists on the remote repository
    let branch_url = format!(
        "https://api.github.com/repos/{}/{}/branches/{}",
        owner, repo, branch
    );
    let branch_resp = client
        .get(&branch_url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Espander-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await;

    let branch_exists = match branch_resp {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    let mut remote_files = Vec::new();

    if branch_exists {
        // 1. Fetch remote files in the directory
        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, path_prefix
        );

        let resp_res = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Espander-App")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .query(&[("ref", &branch)])
            .send()
            .await;

        match resp_res {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    if let Ok(items) = resp.json::<Vec<GithubContentItem>>().await {
                        remote_files = items;
                    }
                } else if status == reqwest::StatusCode::NOT_FOUND {
                    // Directory does not exist yet; proceed with empty remote files list
                } else {
                    let err_body = resp.text().await.unwrap_or_default();
                    return Err(EspanderError::SyncFailed(format!(
                        "GitHub returned error status {}: {}",
                        status, err_body
                    )));
                }
            }
            Err(e) => {
                return Err(EspanderError::SyncFailed(format!(
                    "Failed to connect to GitHub REST API: {}",
                    e
                )));
            }
        }
    }

    // Filter remote files for YAML files
    let remote_yaml_files: Vec<GithubContentItem> = remote_files
        .into_iter()
        .filter(|item| {
            item.item_type == "file"
                && (item.name.ends_with(".yaml") || item.name.ends_with(".yml"))
        })
        .collect();

    let mut remote_snippets: Vec<Snippet> = Vec::new();
    let mut remote_categories: Vec<Category> = Vec::new();
    let mut remote_file_shas: HashMap<String, String> = HashMap::new();
    let mut remote_file_names: HashMap<String, String> = HashMap::new();
    let mut remote_file_contents: HashMap<String, String> = HashMap::new();

    // 2. Download and parse remote YAML files
    for item in remote_yaml_files {
        let file_stem = Path::new(&item.name)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        let category_id = file_stem.to_lowercase().replace(' ', "-");

        remote_file_shas.insert(category_id.clone(), item.sha.clone());
        remote_file_names.insert(category_id.clone(), item.name.clone());

        // Construct direct Contents REST API call to fetch file raw content
        let remote_file_path = format!("{}/{}", path_prefix, item.name);
        let file_url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, remote_file_path
        );

        let dl_resp = client
            .get(&file_url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "Espander-App")
            .header("Accept", "application/vnd.github.raw")
            .query(&[("ref", &branch)])
            .send()
            .await
            .map_err(|e| {
                EspanderError::SyncFailed(format!(
                    "Failed to download remote file {}: {}",
                    item.name, e
                ))
            })?;

        let status = dl_resp.status();
        if status.is_success() {
            let content_str = dl_resp.text().await.map_err(|e| {
                EspanderError::SyncFailed(format!(
                    "Failed to read content of remote file {}: {}",
                    item.name, e
                ))
            })?;

            remote_file_contents.insert(category_id.clone(), content_str.clone());

            match serde_yaml::from_str::<YamlFileContent>(&content_str) {
                Ok(yaml_data) => {
                    let category_name = if category_id == "global" {
                        "Global".to_string()
                    } else {
                        let mut chars = file_stem.chars();
                        match chars.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                        }
                    };

                    remote_categories.push(Category {
                        id: category_id.clone(),
                        name: category_name,
                        icon: "folder".to_string(),
                        color: "#6366f1".to_string(),
                        sort_order: 99,
                        created_at: Utc::now(),
                    });

                    for m in yaml_data.matches {
                        let updated_at = m
                            .updated_at
                            .and_then(|t| DateTime::parse_from_rfc3339(&t).ok())
                            .map(|t| t.with_timezone(&Utc))
                            .unwrap_or_else(Utc::now);

                        remote_snippets.push(Snippet {
                            id: format!("{}-{}", category_id, m.trigger.trim_start_matches(':')),
                            trigger: m.trigger,
                            replace: m.replace,
                            category_id: category_id.clone(),
                            description: m.description.unwrap_or_default(),
                            notes: m.notes,
                            tags: m.tags.unwrap_or_default(),
                            is_favorite: m.is_favorite.unwrap_or(false),
                            is_paused: m.is_paused.unwrap_or(false),
                            is_protected: m.is_protected.unwrap_or(false),
                            source: "github".to_string(),
                            created_at: updated_at,
                            updated_at,
                            sync_status: SyncStatus::Synced,
                        });
                    }
                }
                Err(e) => {
                    return Err(EspanderError::SyncFailed(format!(
                        "Failed to parse YAML content of remote file {}: {}. Make sure it is in correct Espanso format with a 'matches' list.",
                        item.name, e
                    )));
                }
            }
        } else {
            return Err(EspanderError::SyncFailed(format!(
                "Failed to retrieve file {} content from GitHub (HTTP status: {})",
                item.name, status
            )));
        }
    }

    // 3. Load local database files and sync status
    let mut local_categories_file: CategoryFile = db.read_json(&db.categories_path).await?;
    let local_snippets_file: SnippetFile = db.read_json(&db.snippets_path).await?;

    let mut snippets_pulled = 0u32;
    let mut snippets_pushed = 0u32;
    let conflicts = 0u32;

    // Merge remote categories into local categories list
    for r_cat in remote_categories {
        if !local_categories_file
            .categories
            .iter()
            .any(|c| c.id == r_cat.id)
        {
            local_categories_file.categories.push(r_cat);
        }
    }

    let mut remote_by_trigger: HashMap<String, Snippet> = remote_snippets
        .into_iter()
        .map(|s| (s.trigger.to_lowercase(), s))
        .collect();

    let local_by_trigger: HashMap<String, Snippet> = local_snippets_file
        .snippets
        .into_iter()
        .map(|s| (s.trigger.to_lowercase(), s))
        .collect();

    let mut merged_snippets: HashMap<String, Snippet> = HashMap::new();

    // Iterate through local snippets to reconcile with remote
    for (trigger_key, mut l_snip) in local_by_trigger {
        if let Some(r_snip) = remote_by_trigger.remove(&trigger_key) {
            // Case 1: Snippet exists on both remote and local
            if l_snip.sync_status == SyncStatus::Modified {
                if r_snip.updated_at > l_snip.updated_at {
                    // Remote is newer, pull it (keep local ID)
                    let old_id = l_snip.id.clone();
                    l_snip = r_snip;
                    l_snip.id = old_id;
                    l_snip.sync_status = SyncStatus::Synced;
                    snippets_pulled += 1;
                } else {
                    // Local is newer, keep local (will push it)
                }
            } else if l_snip.sync_status == SyncStatus::Local {
                if r_snip.updated_at > l_snip.updated_at {
                    let old_id = l_snip.id.clone();
                    l_snip = r_snip;
                    l_snip.id = old_id;
                    l_snip.sync_status = SyncStatus::Synced;
                    snippets_pulled += 1;
                }
            } else {
                // Synced or Conflict
                // Pull remote if there are any differences
                if l_snip.replace != r_snip.replace
                    || l_snip.description != r_snip.description
                    || l_snip.category_id != r_snip.category_id
                    || l_snip.tags != r_snip.tags
                    || l_snip.is_favorite != r_snip.is_favorite
                    || l_snip.is_paused != r_snip.is_paused
                    || l_snip.is_protected != r_snip.is_protected
                {
                    let old_id = l_snip.id.clone();
                    l_snip = r_snip;
                    l_snip.id = old_id;
                    l_snip.sync_status = SyncStatus::Synced;
                    snippets_pulled += 1;
                }
            }
            merged_snippets.insert(trigger_key, l_snip);
        } else {
            // Case 2: Snippet exists locally but NOT on remote.
            // GitHub sync is additive: keep it locally and include it in the next upload.
            merged_snippets.insert(trigger_key, l_snip);
        }
    }

    // Case 3: Snippet exists on remote but NOT locally
    for (trigger_key, r_snip) in remote_by_trigger {
        // GitHub sync is additive: pull remote-only snippets into the local database.
        let mut snip = r_snip;
        snip.sync_status = SyncStatus::Synced;
        merged_snippets.insert(trigger_key, snip);
        snippets_pulled += 1;
    }

    let mut merged_snippets_list: Vec<Snippet> = merged_snippets.into_values().collect();

    // 4. Group snippets by category ID and determine remote file operations
    let mut grouped: HashMap<String, Vec<Snippet>> = HashMap::new();
    for s in &merged_snippets_list {
        let cat_id = if s.category_id.trim().is_empty() {
            "global".to_string()
        } else {
            if local_categories_file
                .categories
                .iter()
                .any(|c| c.id == s.category_id)
            {
                s.category_id.clone()
            } else {
                "global".to_string()
            }
        };
        grouped.entry(cat_id).or_default().push(s.clone());
    }

    // Keep track of categories we updated/created so we can identify deleted/orphaned ones
    let mut processed_category_ids = std::collections::HashSet::new();

    // 5. Write YAML files via GitHub Contents API
    for (cat_id, snippets) in grouped {
        if snippets.is_empty() {
            continue;
        }
        processed_category_ids.insert(cat_id.clone());

        let yaml_matches: Vec<YamlMatch> = snippets
            .iter()
            .map(|s| YamlMatch {
                trigger: s.trigger.clone(),
                replace: s.replace.clone(),
                description: if s.description.is_empty() {
                    None
                } else {
                    Some(s.description.clone())
                },
                notes: s.notes.clone(),
                tags: if s.tags.is_empty() {
                    None
                } else {
                    Some(s.tags.clone())
                },
                is_favorite: Some(s.is_favorite),
                is_paused: Some(s.is_paused),
                is_protected: Some(s.is_protected),
                updated_at: Some(s.updated_at.to_rfc3339()),
            })
            .collect();

        let yaml_content = YamlFileContent {
            matches: yaml_matches,
        };
        let yaml_str = serde_yaml::to_string(&yaml_content)
            .map_err(|e| EspanderError::Other(format!("Failed to serialize YAML: {}", e)))?;

        let filename = remote_file_names
            .get(&cat_id)
            .cloned()
            .unwrap_or_else(|| format!("{}.yml", cat_id));
        let remote_path = format!("{}/{}", path_prefix, filename);
        let existing_sha = remote_file_shas.get(&cat_id).cloned();
        let existing_content = remote_file_contents.get(&cat_id);

        let should_upload = match existing_content {
            Some(existing) => existing.trim() != yaml_str.trim(),
            None => true,
        };

        if should_upload {
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            let b64_content = STANDARD.encode(yaml_str.as_bytes());

            let put_url = format!(
                "https://api.github.com/repos/{}/{}/contents/{}",
                owner, repo, remote_path
            );

            let payload = GithubPutUpdatePayload {
                message: format!("Synchronized category matches: {}", cat_id),
                content: b64_content,
                sha: existing_sha,
                branch: if branch_exists {
                    Some(branch.clone())
                } else {
                    None
                },
            };

            let put_resp = client
                .put(&put_url)
                .header("Authorization", format!("Bearer {}", token))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Espander-App")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .json(&payload)
                .send()
                .await
                .map_err(|e| {
                    EspanderError::SyncFailed(format!(
                        "Failed to upload file {}: {}",
                        remote_path, e
                    ))
                })?;

            let status = put_resp.status();
            if !status.is_success() {
                let err_body = put_resp.text().await.unwrap_or_default();
                return Err(EspanderError::SyncFailed(format!(
                    "Failed to create/update file {} on GitHub (HTTP {}): {}",
                    remote_path, status, err_body
                )));
            }

            // Count number of snippets that were newly added or modified locally as pushed
            let mut pushed_count = 0u32;
            for s in &snippets {
                if s.sync_status == SyncStatus::Local || s.sync_status == SyncStatus::Modified {
                    pushed_count += 1;
                }
            }
            snippets_pushed += if pushed_count > 0 { pushed_count } else { 1 };
        }
    }

    // 6. Delete remote YAML files for categories that no longer exist
    for (cat_id, sha) in remote_file_shas {
        if !processed_category_ids.contains(&cat_id) {
            let filename = remote_file_names
                .get(&cat_id)
                .cloned()
                .unwrap_or_else(|| format!("{}.yml", cat_id));
            let remote_path = format!("{}/{}", path_prefix, filename);
            let delete_url = format!(
                "https://api.github.com/repos/{}/{}/contents/{}",
                owner, repo, remote_path
            );

            let payload = GithubDeletePayload {
                message: format!("Deleted orphaned category: {}", cat_id),
                sha,
                branch: if branch_exists {
                    Some(branch.clone())
                } else {
                    None
                },
            };

            let delete_resp = client
                .delete(&delete_url)
                .header("Authorization", format!("Bearer {}", token))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Espander-App")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .json(&payload)
                .send()
                .await
                .map_err(|e| {
                    EspanderError::SyncFailed(format!(
                        "Failed to delete remote file {}: {}",
                        remote_path, e
                    ))
                })?;

            let status = delete_resp.status();
            if !status.is_success() {
                let err_body = delete_resp.text().await.unwrap_or_default();
                return Err(EspanderError::SyncFailed(format!(
                    "Failed to delete file {} on GitHub (HTTP {}): {}",
                    remote_path, status, err_body
                )));
            }
            snippets_pushed += 1;
        }
    }

    // 7. Mark all local snippets as Synced and write database back locally
    for s in merged_snippets_list.iter_mut() {
        s.sync_status = SyncStatus::Synced;
    }
    db.write_json(&db.categories_path, &local_categories_file)
        .await?;
    db.write_json(
        &db.snippets_path,
        &SnippetFile {
            version: 1,
            snippets: merged_snippets_list.clone(),
        },
    )
    .await?;

    Ok(SyncResult {
        success: true,
        snippets_pulled,
        snippets_pushed,
        conflicts,
        message: if snippets_pulled == 0 && snippets_pushed == 0 {
            "Everything is already synchronized. No new snippets were found.".to_string()
        } else {
            format!(
                "Successfully synchronized! (Pulled {}, Pushed {} updates)",
                snippets_pulled, snippets_pushed
            )
        },
    })
}
