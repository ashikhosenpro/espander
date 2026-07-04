use crate::db::schema::Snippet;
use crate::error::EspanderError;

#[derive(Debug, Clone, PartialEq)]
pub enum SyncProviderType {
    GitHub,
    GoogleSheet,
    Local,
}

impl SyncProviderType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "github" => SyncProviderType::GitHub,
            "gsheet" => SyncProviderType::GoogleSheet,
            _ => SyncProviderType::Local,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            SyncProviderType::GitHub => "github",
            SyncProviderType::GoogleSheet => "gsheet",
            SyncProviderType::Local => "local",
        }
    }
}

pub trait SyncProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn provider_type(&self) -> SyncProviderType;

    fn is_connected(&self)
        -> impl std::future::Future<Output = Result<bool, EspanderError>> + Send;
    fn connect(&mut self) -> impl std::future::Future<Output = Result<(), EspanderError>> + Send;
    fn disconnect(&mut self)
        -> impl std::future::Future<Output = Result<(), EspanderError>> + Send;

    fn pull(&self)
        -> impl std::future::Future<Output = Result<Vec<Snippet>, EspanderError>> + Send;
    fn push(
        &self,
        _snippets: &[Snippet],
    ) -> impl std::future::Future<Output = Result<(), EspanderError>> + Send;
}
