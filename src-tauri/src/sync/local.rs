use super::provider::{SyncProvider, SyncProviderType};
use crate::db::schema::Snippet;
use crate::error::EspanderError;

pub struct LocalProvider;

impl LocalProvider {
    pub fn new() -> Self {
        Self
    }
}

impl SyncProvider for LocalProvider {
    fn name(&self) -> &'static str {
        "Local Only"
    }

    fn provider_type(&self) -> SyncProviderType {
        SyncProviderType::Local
    }

    async fn is_connected(&self) -> Result<bool, EspanderError> {
        Ok(true)
    }

    async fn connect(&mut self) -> Result<(), EspanderError> {
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), EspanderError> {
        Ok(())
    }

    async fn pull(&self) -> Result<Vec<Snippet>, EspanderError> {
        Ok(Vec::new())
    }

    async fn push(&self, _snippets: &[Snippet]) -> Result<(), EspanderError> {
        Ok(())
    }
}
