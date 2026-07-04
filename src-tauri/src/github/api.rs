use serde::Deserialize;

use crate::db::schema::GitHubRepo;
use crate::error::EspanderError;

#[derive(Debug, Deserialize)]
struct RepoResponse {
    id: u64,
    name: String,
    owner: OwnerResponse,
    full_name: String,
    description: Option<String>,
    private: bool,
    html_url: String,
}

#[derive(Debug, Deserialize)]
struct OwnerResponse {
    login: String,
}

#[derive(Debug, Deserialize)]
struct ContentResponse {
    content: Option<String>,
    sha: String,
    encoding: String,
}

pub struct GitHubApi {
    token: String,
    client: reqwest::Client,
}

impl GitHubApi {
    pub fn new(token: String) -> Self {
        Self {
            token,
            client: reqwest::Client::new(),
        }
    }

    pub async fn get_user(&self) -> Result<String, EspanderError> {
        let resp = self
            .get::<serde_json::Value>("https://api.github.com/user")
            .await?;
        Ok(resp["login"].as_str().unwrap_or("unknown").to_string())
    }

    pub async fn list_repos(&self) -> Result<Vec<GitHubRepo>, EspanderError> {
        let repos: Vec<RepoResponse> = self
            .get("https://api.github.com/user/repos?per_page=100&sort=updated")
            .await?;
        Ok(repos
            .into_iter()
            .map(|r| GitHubRepo {
                id: r.id,
                name: r.name,
                owner: r.owner.login,
                full_name: r.full_name,
                description: r.description,
                private: r.private,
                html_url: r.html_url,
            })
            .collect())
    }

    pub async fn create_repo(&self, name: &str) -> Result<GitHubRepo, EspanderError> {
        let body = serde_json::json!({
            "name": name,
            "description": "Espanso Companion - managed by Espander",
            "private": true,
            "auto_init": false
        });

        let repo: RepoResponse = self.post("https://api.github.com/user/repos", body).await?;

        Ok(GitHubRepo {
            id: repo.id,
            name: repo.name,
            owner: repo.owner.login,
            full_name: repo.full_name,
            description: repo.description,
            private: repo.private,
            html_url: repo.html_url,
        })
    }

    pub async fn get_file_content(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<(String, String), EspanderError> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, path
        );
        let content: ContentResponse = self.get(&url).await?;

        let decoded = if content.encoding == "base64" {
            let bytes = base64_decode(&content.content.unwrap_or_default())?;
            String::from_utf8_lossy(&bytes).to_string()
        } else {
            content.content.unwrap_or_default()
        };

        Ok((decoded, content.sha))
    }

    pub async fn create_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        content: &str,
        message: &str,
    ) -> Result<(), EspanderError> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, path
        );
        let body = serde_json::json!({
            "message": message,
            "content": base64_encode(content)
        });
        self.put(&url, body).await
    }

    pub async fn update_file(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
        content: &str,
        sha: &str,
        message: &str,
    ) -> Result<(), EspanderError> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            owner, repo, path
        );
        let body = serde_json::json!({
            "message": message,
            "content": base64_encode(content),
            "sha": sha
        });
        self.put(&url, body).await
    }

    async fn get<T: serde::de::DeserializeOwned>(&self, url: &str) -> Result<T, EspanderError> {
        let resp = self
            .client
            .get(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "espander")
            .send()
            .await
            .map_err(|e| EspanderError::GitHub(format!("GET failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(EspanderError::GitHub(format!(
                "GitHub API error {}: {}",
                status, text
            )));
        }

        resp.json()
            .await
            .map_err(|e| EspanderError::GitHub(format!("JSON parse error: {}", e)))
    }

    async fn post<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
        body: serde_json::Value,
    ) -> Result<T, EspanderError> {
        let resp = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "espander")
            .json(&body)
            .send()
            .await
            .map_err(|e| EspanderError::GitHub(format!("POST failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(EspanderError::GitHub(format!(
                "GitHub API error {}: {}",
                status, text
            )));
        }

        resp.json()
            .await
            .map_err(|e| EspanderError::GitHub(format!("JSON parse error: {}", e)))
    }

    async fn put(&self, url: &str, body: serde_json::Value) -> Result<(), EspanderError> {
        let resp = self
            .client
            .put(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "espander")
            .json(&body)
            .send()
            .await
            .map_err(|e| EspanderError::GitHub(format!("PUT failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(EspanderError::GitHub(format!(
                "GitHub API error {}: {}",
                status, text
            )));
        }

        Ok(())
    }
}

fn base64_encode(input: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(input)
}

fn base64_decode(input: &str) -> Result<Vec<u8>, EspanderError> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(input)
        .map_err(|e| EspanderError::GitHub(format!("Base64 decode error: {}", e)))
}
