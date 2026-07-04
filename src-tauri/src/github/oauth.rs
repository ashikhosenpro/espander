use serde::Deserialize;

use crate::db::schema::{DeviceFlowResponse, OAuthResult};
use crate::error::EspanderError;

const CLIENT_ID: &str = "Iv23li8kY6NXEMIuPk4q"; // Espander GitHub OAuth App

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    interval: u32,
}

#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    #[allow(dead_code)]
    error_description: Option<String>,
}

pub async fn start_device_flow() -> Result<DeviceFlowResponse, EspanderError> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .header("User-Agent", "Espander-App")
        .form(&[("client_id", CLIENT_ID), ("scope", "repo")])
        .send()
        .await
        .map_err(|e| EspanderError::OAuth(format!("Failed to start device flow: {}", e)))?;

    let status = resp.status();
    let body_text = resp.text().await.map_err(|e| {
        EspanderError::OAuth(format!("Failed to read device flow response body: {}", e))
    })?;

    if !status.is_success() {
        return Err(EspanderError::OAuth(format!(
            "GitHub returned HTTP error status {}: {}",
            status, body_text
        )));
    }

    let device: DeviceCodeResponse = serde_json::from_str(&body_text).map_err(|e| {
        // Try parsing as standard GitHub error response
        #[derive(Deserialize)]
        struct GitHubErrorResponse {
            error: Option<String>,
            error_description: Option<String>,
        }
        if let Ok(err_resp) = serde_json::from_str::<GitHubErrorResponse>(&body_text) {
            if let Some(err) = err_resp.error {
                let desc = err_resp.error_description.unwrap_or_default();
                return EspanderError::OAuth(format!("GitHub OAuth Error ({}): {}", err, desc));
            }
        }
        EspanderError::OAuth(format!(
            "Failed to parse device flow response: {}. Raw response: {}",
            e, body_text
        ))
    })?;

    Ok(DeviceFlowResponse {
        device_code: device.device_code,
        user_code: device.user_code,
        verification_uri: device.verification_uri,
        interval: device.interval,
    })
}

pub async fn poll_for_token(
    device_code: &str,
    interval: u32,
) -> Result<OAuthResult, EspanderError> {
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(interval as u64)).await;

        let client = reqwest::Client::new();
        let resp = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .header("User-Agent", "Espander-App")
            .form(&[
                ("client_id", CLIENT_ID),
                ("device_code", device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|e| EspanderError::OAuth(format!("Polling failed: {}", e)))?;

        let body_text = resp.text().await.map_err(|e| {
            EspanderError::OAuth(format!("Failed to read token response body: {}", e))
        })?;

        let token: AccessTokenResponse = serde_json::from_str(&body_text).map_err(|e| {
            EspanderError::OAuth(format!(
                "Failed to parse token response: {}. Raw response: {}",
                e, body_text
            ))
        })?;

        match (token.access_token, token.error.as_deref()) {
            (Some(token), _) => {
                return Ok(OAuthResult {
                    success: true,
                    access_token: Some(token),
                    error: None,
                });
            }
            (_, Some("authorization_pending")) => {
                continue;
            }
            (_, Some(error)) => {
                return Ok(OAuthResult {
                    success: false,
                    access_token: None,
                    error: Some(error.to_string()),
                });
            }
            (None, None) => {
                continue;
            }
        }
    }
}
