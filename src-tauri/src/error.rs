use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum EspanderError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Espanso not found at {0}")]
    EspansoNotFound(String),

    #[error("Espanso reload failed: {0}")]
    EspansoReloadFailed(String),

    #[error("Sync failed: {0}")]
    SyncFailed(String),

    #[error("GitHub API error: {0}")]
    GitHub(String),

    #[error("OAuth failed: {0}")]
    OAuth(String),

    #[error("Invalid CSV URL: {0}")]
    InvalidCsvUrl(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("Not connected to any provider")]
    NotConnected,

    #[error("Already syncing")]
    AlreadySyncing,

    #[error("{0}")]
    Other(String),
}

impl Serialize for EspanderError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
