//! Feed API (twelve-dollar-server-challenge SPEC) tuned for raw throughput.
//!
//! Layout:
//!   * N worker threads, each a single-threaded tokio runtime with its own SO_REUSEPORT
//!     listener and its own SQLite read connection (thread-local: no pool, no locks).
//!   * Reads run inline on the worker: SQLite is in-process and the hot pages are mmap'd,
//!     so a feed query is tens of microseconds.
//!   * One writer thread owns the only write connection and does group commit: it drains
//!     every queued like/post into a single transaction and answers each request after COMMIT.

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

mod db;
mod http;
mod json;
mod jwt;

use std::net::SocketAddr;
use std::sync::OnceLock;
use std::time::Instant;

pub struct Config {
    pub db_path: String,
    pub jwt_secret: Vec<u8>,
    pub started: Instant,
}

pub static CONFIG: OnceLock<Config> = OnceLock::new();

pub fn config() -> &'static Config {
    CONFIG.get().expect("config initialised")
}

fn main() {
    let db_path = std::env::var("SQLITE_PATH").unwrap_or_else(|_| "feed.db".into());
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "twelve-dollar-challenge".into());
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3000);
    let threads: usize = std::env::var("THREADS")
        .ok()
        .and_then(|t| t.parse().ok())
        .unwrap_or_else(|| std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1));

    CONFIG
        .set(Config { db_path, jwt_secret: jwt_secret.into_bytes(), started: Instant::now() })
        .ok()
        .expect("config set once");

    // The writer opens the database first so WAL/-shm exist before readers attach.
    db::start_writer();

    let addr: SocketAddr = format!("{host}:{port}").parse().expect("valid HOST:PORT");
    eprintln!("feed-server listening on http://{addr} with {threads} worker thread(s)");

    let handles: Vec<_> = (0..threads)
        .map(|i| {
            std::thread::Builder::new()
                .name(format!("worker-{i}"))
                .spawn(move || http::run_worker(addr))
                .expect("spawn worker")
        })
        .collect();
    for h in handles {
        let _ = h.join();
    }
}
