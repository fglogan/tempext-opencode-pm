use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use std::path::PathBuf;
use time::OffsetDateTime;

fn base_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow!("no HOME dir"))?;
    Ok(home.join(".tempext-genesis").join("specbundles"))
}

async fn write_text(path: PathBuf, data: &str) -> Result<()> {
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).await?; }
    let mut f = fs::File::create(path).await?;
    f.write_all(data.as_bytes()).await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpecPart {
    pub kind: String,          // "markdown" | "attachment" | "mermaid" | ...
    pub path: Option<String>,  // for attachments
    pub content: Option<String>, // for markdown/mermaid
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpecBundle {
    pub title: String,
    pub created_by: String,
    pub source_sessions: Vec<SourceSession>,
    pub parts: Vec<SpecPart>,
    pub tags: Vec<String>,
    pub redactions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SourceSession {
    pub agent: String,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpecbundleCreateReq {
    pub bundle: SpecBundle,
    pub ingest: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpecbundleCreateResp {
    pub ko_id: String,
    pub stored_parts: usize,
    pub ingested: bool,
}

pub struct SpecbundleService;

impl SpecbundleService {
    /// Handler for target="opencode_pm", op="specbundle.create"
    pub async fn create(req: SpecbundleCreateReq) -> Result<SpecbundleCreateResp> {
        // 0) Guardian redaction pre-check (very simple)
        if let Some(first_md) = req.bundle.parts.iter().find(|p| p.kind == "markdown").and_then(|p| p.content.as_ref()) {
            for pat in &req.bundle.redactions {
                if first_md.contains(pat) {
                    return Err(anyhow!("guardian_redaction_violation: content contains redacted pattern '{}'", pat));
                }
            }
        }

        // 1) Assign KO id + folder
        let ko_id = format!("ko:specbundle/{}", Uuid::new_v4());
        let folder = base_dir()?.join(ko_id.replace(':', "_")); // ko_specbundle_<uuid>
        let parts_dir = folder.join("parts");
        fs::create_dir_all(&parts_dir).await?;

        // 2) Persist bundle.json (metadata snapshot)
        let bundle_json = serde_json::to_string_pretty(&req.bundle)?;
        write_text(folder.join("bundle.json"), &bundle_json).await?;

        // 3) Persist parts
        let mut stored = 0usize;
        for (i, part) in req.bundle.parts.iter().enumerate() {
            let idx = format!("{:04}", i + 1);
            match (part.kind.as_str(), &part.content, &part.path) {
                ("markdown", Some(md), _) => {
                    write_text(parts_dir.join(format!("{idx}.md")), md).await?;
                    stored += 1;
                }
                ("mermaid", Some(mmd), _) => {
                    write_text(parts_dir.join(format!("{idx}.mmd")), mmd).await?;
                    stored += 1;
                }
                ("attachment", _, Some(p)) => {
                    // For now just record the path in a small descriptor
                    let desc = serde_json::json!({ "source_path": p });
                    write_text(parts_dir.join(format!("{idx}.attachment.json")), &desc.to_string()).await?;
                    stored += 1;
                }
                _ => {}
            }
        }

        // 4) Optional ingest enqueue (stub)
        let ingested = req.ingest.unwrap_or(false);
        if ingested {
            let audit = serde_json::json!({
              "event": "INGEST.ENQUEUED",
              "ko_id": ko_id,
              "at": OffsetDateTime::now_utc().to_string(),
              "tags": req.bundle.tags,
              "redactions": req.bundle.redactions,
            });
            write_text(folder.join("audit.json"), &serde_json::to_string_pretty(&audit)?).await?;
            // TODO: emit real event on your bus
        }

        Ok(SpecbundleCreateResp { ko_id, stored_parts: stored, ingested })
    }
}