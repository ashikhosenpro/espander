use crate::db::database::Database;
use crate::error::EspanderError;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::fs;

#[tauri::command]
pub async fn read_about_page(db: State<'_, Database>) -> Result<String, EspanderError> {
    if let Some(remote) = fetch_remote_content("about").await {
        return Ok(remote);
    }

    let path = db.base_dir.join("about.html");
    if !path.exists() {
        let default = include_str!("../../defaults/about.html");
        fs::write(&path, default).await?;
        Ok(default.to_string())
    } else {
        let existing = fs::read_to_string(&path).await?;
        if existing.contains("Visual Manager &amp; Cloud Sync Companion for Espanso") {
            let default = include_str!("../../defaults/about.html");
            fs::write(&path, default).await?;
            Ok(default.to_string())
        } else {
            Ok(existing)
        }
    }
}

#[tauri::command]
pub async fn read_docs_page(db: State<'_, Database>) -> Result<String, EspanderError> {
    if let Some(remote) = fetch_remote_content("docs").await {
        return Ok(remote);
    }

    let path = db.base_dir.join("docs.html");
    if !path.exists() {
        let default = include_str!("../../defaults/docs.html");
        fs::write(&path, default).await?;
        Ok(default.to_string())
    } else {
        let existing = fs::read_to_string(&path).await?;
        if existing.contains("Edit this file to write your own documentation") {
            let default = include_str!("../../defaults/docs.html");
            fs::write(&path, default).await?;
            Ok(default.to_string())
        } else {
            Ok(existing)
        }
    }
}

#[derive(Deserialize)]
struct RemoteContent {
    html: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FooterSettings {
    pub left_text: String,
    pub link_label: String,
    pub link_url: String,
    pub show_github_icon: bool,
}

#[derive(Deserialize)]
struct RemoteFooterContent {
    footer: FooterSettings,
}

#[tauri::command]
pub async fn read_footer_settings() -> Result<FooterSettings, EspanderError> {
    if let Some(remote) = fetch_remote_footer().await {
        return Ok(remote);
    }

    Ok(default_footer_settings())
}

async fn fetch_remote_content(slug: &str) -> Option<String> {
    let url = remote_content_url(slug)?;
    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;

    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }

    response.json::<RemoteContent>().await.ok().map(|content| content.html)
}

async fn fetch_remote_footer() -> Option<FooterSettings> {
    let url = remote_content_url("footer")?;
    let client = reqwest::Client::builder()
        .user_agent("Espander/0.1.0")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;

    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }

    response
        .json::<RemoteFooterContent>()
        .await
        .ok()
        .map(|content| content.footer)
}

fn default_footer_settings() -> FooterSettings {
    FooterSettings {
        left_text: "Espander v0.1.0 · MIT License".to_string(),
        link_label: "GitHub".to_string(),
        link_url: "https://github.com/ashikhosenpro/Expander".to_string(),
        show_github_icon: true,
    }
}

fn remote_content_url(slug: &str) -> Option<String> {
    std::env::var("ESPANDER_CONTENT_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_CONTENT_URL").map(str::to_string))
        .map(|url| url.trim().trim_end_matches('/').to_string())
        .filter(|url| !url.is_empty())
        .map(|base| format!("{}/{}", base, slug))
        .or_else(|| hub_base_url().map(|base| format!("{}/content/{}", base, slug)))
}

fn hub_base_url() -> Option<String> {
    std::env::var("ESPANDER_NOTIFICATIONS_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_NOTIFICATIONS_URL").map(str::to_string))
        .map(|url| url.trim().trim_end_matches('/').to_string())
        .filter(|url| !url.is_empty())
        .and_then(|url| url.strip_suffix("/notifications").map(str::to_string))
}
