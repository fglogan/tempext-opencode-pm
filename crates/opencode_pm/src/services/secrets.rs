use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use keyring::Entry;

const SERVICE_NS: &str = "tempext.genesis.secrets";

#[derive(Debug, Serialize, Deserialize)]
pub struct SecretSetReq { pub provider: String, pub account: String, pub key: String }
#[derive(Debug, Serialize, Deserialize)]
pub struct SecretGetReq { pub provider: String, pub account: String }
#[derive(Debug, Serialize, Deserialize)]
pub struct SecretGetResp { pub exists: bool, pub key: Option<String> }

pub struct SecretsService;

impl SecretsService {
    pub async fn set(req: SecretSetReq) -> Result<()> {
        let entry = Entry::new(&format!("{SERVICE_NS}.{}", req.provider), &req.account)
            .map_err(|e| anyhow!(e.to_string()))?;
        entry.set_password(&req.key).map_err(|e| anyhow!(e.to_string()))?;
        Ok(())
    }

    pub async fn get(req: SecretGetReq) -> Result<SecretGetResp> {
        let entry = Entry::new(&format!("{SERVICE_NS}.{}", req.provider), &req.account)
            .map_err(|e| anyhow!(e.to_string()))?;
        match entry.get_password() {
            Ok(pw) => Ok(SecretGetResp { exists: true, key: Some(pw) }),
            Err(keyring::Error::NoEntry) => Ok(SecretGetResp { exists: false, key: None }),
            Err(e) => Err(anyhow!(e.to_string()))
        }
    }
}