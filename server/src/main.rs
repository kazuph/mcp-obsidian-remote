use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod crypto;
mod handlers;
mod models;
mod server;
mod vault;

use config::Config;
use server::start_server;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to the Obsidian vault
    #[arg(short, long, env = "VAULT_PATH")]
    vault_path: Option<PathBuf>,

    /// Port for HTTPS server
    #[arg(short, long, default_value = "27123", env = "HTTPS_PORT")]
    port: u16,

    /// Port for HTTP server (if enabled)
    #[arg(long, default_value = "27124", env = "HTTP_PORT")]
    http_port: u16,

    /// Enable HTTP server (insecure)
    #[arg(long, default_value = "false", env = "ENABLE_HTTP")]
    enable_http: bool,

    /// Binding host
    #[arg(short, long, default_value = "127.0.0.1", env = "BIND_HOST")]
    bind_host: String,

    /// API key for authentication
    #[arg(short, long, env = "API_KEY")]
    api_key: Option<String>,

    /// Subject alternative names for certificate (comma-separated)
    #[arg(long, env = "CERT_SUBJECT_ALT_NAMES")]
    cert_alt_names: Option<String>,

    /// Certificate and key files directory
    #[arg(long, default_value = "./certs", env = "CERT_DIR")]
    cert_dir: PathBuf,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables from .env file if it exists
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "obsidian_api_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let args = Args::parse();

    // Validate vault path
    let vault_path = match args.vault_path {
        Some(path) => {
            if !path.exists() {
                anyhow::bail!("Vault path does not exist: {}", path.display());
            }
            if !path.is_dir() {
                anyhow::bail!("Vault path is not a directory: {}", path.display());
            }
            path
        }
        None => {
            // Try to find an Obsidian vault in common locations
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            let common_paths = [
                format!("{}/Documents/Obsidian Vault", home),
                format!("{}/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault", home),
                "./vault".to_string(),
                ".".to_string(),
            ];

            let mut found_path = None;
            for path_str in &common_paths {
                let path = PathBuf::from(path_str);
                if path.exists() && path.is_dir() {
                    // Check if it looks like an Obsidian vault (has .obsidian directory or .md files)
                    if path.join(".obsidian").exists() || 
                       walkdir::WalkDir::new(&path)
                           .max_depth(2)
                           .into_iter()
                           .filter_map(|e| e.ok())
                           .any(|e| e.path().extension().map_or(false, |ext| ext == "md")) {
                        found_path = Some(path);
                        break;
                    }
                }
            }

            match found_path {
                Some(path) => {
                    info!("Auto-detected vault path: {}", path.display());
                    path
                }
                None => {
                    anyhow::bail!(
                        "Could not find Obsidian vault. Please specify --vault-path or set VAULT_PATH environment variable.\n\
                        Searched in: {}",
                        common_paths.join(", ")
                    );
                }
            }
        }
    };

    // Generate API key if not provided
    let api_key = args.api_key.unwrap_or_else(|| {
        let key = uuid::Uuid::new_v4().simple().to_string();
        warn!("No API key provided. Generated: {}", key);
        warn!("Set API_KEY environment variable or use --api-key flag to use a specific key");
        key
    });

    // Parse subject alternative names
    let cert_alt_names: Vec<String> = args
        .cert_alt_names
        .map(|names| names.split(',').map(|s| s.trim().to_string()).collect())
        .unwrap_or_default();

    let config = Config {
        vault_path,
        port: args.port,
        http_port: args.http_port,
        enable_http: args.enable_http,
        bind_host: args.bind_host,
        api_key,
        cert_alt_names,
        cert_dir: args.cert_dir,
    };

    info!("Starting Obsidian API Server");
    info!("Vault path: {}", config.vault_path.display());
    info!("HTTPS port: {}", config.port);
    if config.enable_http {
        info!("HTTP port: {} (INSECURE)", config.http_port);
    }
    info!("Bind host: {}", config.bind_host);

    start_server(config).await
}
