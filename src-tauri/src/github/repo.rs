use super::api::GitHubApi;
use crate::error::EspanderError;

pub async fn initialize_repo(
    api: &GitHubApi,
    owner: &str,
    repo: &str,
) -> Result<(), EspanderError> {
    let manifest = serde_json::json!({
        "version": 1,
        "app": "espander",
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    let readme = "# Espanso Companion\n\nManaged by [Espander](https://espander.app).\n\nThis repository is automatically managed. Do not edit files directly.\n";

    api.create_file(
        owner,
        repo,
        "manifest.json",
        &manifest.to_string(),
        "Initialize Espander manifest",
    )
    .await?;

    api.create_file(owner, repo, "README.md", readme, "Add README")
        .await?;

    api.create_file(
        owner,
        repo,
        "snippets/personal.json",
        r#"{"version":1,"snippets":[]}"#,
        "Initialize personal snippets",
    )
    .await?;

    api.create_file(
        owner,
        repo,
        "snippets/coding.json",
        r#"{"version":1,"snippets":[]}"#,
        "Initialize coding snippets",
    )
    .await?;

    api.create_file(owner, repo, "settings.json", "{}", "Initialize settings")
        .await?;

    Ok(())
}
