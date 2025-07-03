use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub vault_path: PathBuf,
    pub port: u16,
    pub http_port: u16,
    pub enable_http: bool,
    pub bind_host: String,
    pub api_key: String,
    pub cert_alt_names: Vec<String>,
    pub cert_dir: PathBuf,
}

impl Config {
    pub fn https_bind_address(&self) -> String {
        format!("{}:{}", self.bind_host, self.port)
    }

    pub fn http_bind_address(&self) -> String {
        format!("{}:{}", self.bind_host, self.http_port)
    }

    pub fn cert_file_path(&self) -> PathBuf {
        self.cert_dir.join("server.crt")
    }

    pub fn key_file_path(&self) -> PathBuf {
        self.cert_dir.join("server.key")
    }
}