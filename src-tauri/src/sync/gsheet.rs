use super::provider::{SyncProvider, SyncProviderType};
use crate::db::schema::Snippet;
use crate::error::EspanderError;

pub struct GSheetProvider {
    csv_url: Option<String>,
}

impl GSheetProvider {
    pub fn new() -> Self {
        Self { csv_url: None }
    }

    pub fn with_url(url: String) -> Self {
        Self { csv_url: Some(url) }
    }
}

impl SyncProvider for GSheetProvider {
    fn name(&self) -> &'static str {
        "Google Sheets"
    }

    fn provider_type(&self) -> SyncProviderType {
        SyncProviderType::GoogleSheet
    }

    async fn is_connected(&self) -> Result<bool, EspanderError> {
        Ok(self.csv_url.is_some())
    }

    async fn connect(&mut self) -> Result<(), EspanderError> {
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), EspanderError> {
        self.csv_url = None;
        Ok(())
    }

    async fn pull(&self) -> Result<Vec<Snippet>, EspanderError> {
        Err(EspanderError::NotConnected)
    }

    async fn push(&self, _snippets: &[Snippet]) -> Result<(), EspanderError> {
        Err(EspanderError::SyncFailed(
            "Google Sheets is import-only".to_string(),
        ))
    }
}

pub fn validate_gsheet_url(url: &str) -> bool {
    url.contains("docs.google.com/spreadsheets")
        && url.contains("/pub")
        && url.contains("output=csv")
}
