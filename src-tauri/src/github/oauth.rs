use serde::Deserialize;

use crate::db::schema::{DeviceFlowResponse, OAuthResult};
use crate::error::EspanderError;

#[derive(Debug, Deserialize)]
struct HubOAuthStatus {
    success: bool,
    access_token: Option<String>,
    error: Option<String>,
}

fn hub_base_url() -> Result<String, EspanderError> {
    let notifications = std::env::var("ESPANDER_NOTIFICATIONS_URL")
        .ok()
        .or_else(|| option_env!("ESPANDER_NOTIFICATIONS_URL").map(str::to_string))
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| EspanderError::OAuth("Espander Control Hub is not configured in this build.".to_string()))?;

    notifications
        .strip_suffix("/notifications")
        .map(str::to_string)
        .ok_or_else(|| EspanderError::OAuth("Espander Control Hub URL is invalid.".to_string()))
}

pub async fn start_device_flow() -> Result<DeviceFlowResponse, EspanderError> {
    let url = format!("{}/github/oauth/start", hub_base_url()?);
    let response = reqwest::Client::new()
        .post(url)
        .header("Accept", "application/json")
        .header("User-Agent", "Espander-App")
        .send()
        .await
        .map_err(|e| EspanderError::OAuth(format!("Failed to contact Espander Control Hub: {}", e)))?;
    let status = response.status();
    let body = response.text().await.map_err(|e| EspanderError::OAuth(format!("Failed to read OAuth response: {}", e)))?;
    if !status.is_success() {
        return Err(EspanderError::OAuth(format!("Espander Control Hub returned HTTP {}: {}", status, body)));
    }
    serde_json::from_str(&body).map_err(|e| EspanderError::OAuth(format!("Invalid OAuth response: {}", e)))
}

pub async fn poll_for_token(device_code: &str, interval: u32) -> Result<OAuthResult, EspanderError> {
    let url = format!("{}/github/oauth/status", hub_base_url()?);
    let client = reqwest::Client::new();
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(interval.max(2) as u64)).await;
        let response = client
            .post(&url)
            .header("Accept", "application/json")
            .header("User-Agent", "Espander-App")
            .form(&[("device_code", device_code)])
            .send()
            .await
            .map_err(|e| EspanderError::OAuth(format!("OAuth status check failed: {}", e)))?;
        let status = response.status();
        let body = response.text().await.map_err(|e| EspanderError::OAuth(format!("Failed to read OAuth status: {}", e)))?;
        if !status.is_success() {
            return Err(EspanderError::OAuth(format!("Espander Control Hub returned HTTP {}: {}", status, body)));
        }
        let result: HubOAuthStatus = serde_json::from_str(&body)
            .map_err(|e| EspanderError::OAuth(format!("Invalid OAuth status response: {}", e)))?;
        if result.success {
            return Ok(OAuthResult { success: true, access_token: result.access_token, error: None });
        }
        if result.error.as_deref() == Some("authorization_pending") {
            continue;
        }
        return Ok(OAuthResult { success: false, access_token: None, error: result.error });
    }
}
