use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct KoRef {
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextPack {
    pub ko_id: String,
    pub items: Vec<KoRef>,
    pub redactions: Vec<String>,
}
