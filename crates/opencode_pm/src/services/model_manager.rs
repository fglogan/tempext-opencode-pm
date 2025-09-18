use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatItem {
    pub provider: String,
    pub model: String,
    pub persona: Option<String>,
    pub session_id: String,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatBatchReq {
    pub batch: Vec<ChatItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatBatchResp {
    pub results: Vec<ChatBatchItemResp>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatBatchItemResp {
    pub session_id: String,
    pub content: String,
    pub usage_tokens: Option<u32>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub latency_ms: Option<u64>,
}

pub struct ModelManagerService;

impl ModelManagerService {
    pub async fn chat_batch(req: ChatBatchReq) -> Result<ChatBatchResp> {
        // TEMP: echo response so the UI pipeline is verifiable
        let results = req.batch.into_iter().map(|it| ChatBatchItemResp {
            session_id: it.session_id,
            content: format!("(stub) {} → {} responded to: {}", it.provider, it.model, it.messages.last().map(|m| &m.content).unwrap_or(&"".into())),
            usage_tokens: None,
            provider: Some(it.provider),
            model: Some(it.model),
            latency_ms: Some(25),
        }).collect();

        Ok(ChatBatchResp { results })
    }
}