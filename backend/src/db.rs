use std::cell::RefCell;
use std::time::Duration;

use crossbeam_channel::{Receiver, Sender};
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use tokio::sync::oneshot;

use crate::config;
use crate::json;

macro_rules! post_select {
    ($tail:literal) => {
        concat!(
            "SELECT p.id, p.body, p.created_at, u.username, ",
            "(SELECT count(*) FROM likes l WHERE l.post_id = p.id) ",
            "FROM posts p JOIN users u ON u.id = p.user_id",
            $tail
        )
    };
}

fn open(read_only_queries: bool) -> rusqlite::Result<Connection> {
    let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX | OpenFlags::SQLITE_OPEN_URI;
    let conn = Connection::open_with_flags(&config().db_path, flags)?;
    conn.busy_timeout(Duration::from_secs(5))?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA temp_store = MEMORY;
         PRAGMA mmap_size = 1073741824;
         PRAGMA cache_size = -65536;",
    )?;
    if read_only_queries {
        conn.execute_batch("PRAGMA query_only = ON;")?;
    }
    conn.set_prepared_statement_cache_capacity(16);
    Ok(conn)
}

// ---------------------------------------------------------------- reads (worker threads)

thread_local! {
    static READER: RefCell<Option<Connection>> = const { RefCell::new(None) };
}

fn with_reader<T>(f: impl FnOnce(&Connection) -> rusqlite::Result<T>) -> rusqlite::Result<T> {
    READER.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            *slot = Some(open(true)?);
        }
        f(slot.as_ref().unwrap())
    })
}

pub fn health() -> rusqlite::Result<()> {
    with_reader(|c| c.prepare_cached("SELECT 1")?.query_row([], |_| Ok(())))
}

/// Writes `{"posts":[...]}` for the 20 newest posts into `out`.
pub fn feed(out: &mut Vec<u8>) -> rusqlite::Result<()> {
    with_reader(|c| {
        let mut stmt = c.prepare_cached(post_select!(" ORDER BY p.created_at DESC, p.id DESC LIMIT 20"))?;
        let mut rows = stmt.raw_query();
        out.extend_from_slice(b"{\"posts\":[");
        let mut first = true;
        while let Some(row) = rows.next()? {
            if !first {
                out.push(b',');
            }
            first = false;
            write_post_row(out, row)?;
        }
        out.extend_from_slice(b"]}");
        Ok(())
    })
}

/// Writes `{"post":{...}}` into `out`; Ok(false) when the post doesn't exist.
pub fn post(out: &mut Vec<u8>, id: i64) -> rusqlite::Result<bool> {
    with_reader(|c| {
        let mut stmt = c.prepare_cached(post_select!(" WHERE p.id = ?1"))?;
        let mut rows = stmt.query([id])?;
        match rows.next()? {
            Some(row) => {
                out.extend_from_slice(b"{\"post\":");
                write_post_row(out, row)?;
                out.push(b'}');
                Ok(true)
            }
            None => Ok(false),
        }
    })
}

pub fn post_exists(id: i64) -> rusqlite::Result<bool> {
    with_reader(|c| {
        c.prepare_cached("SELECT 1 FROM posts WHERE id = ?1")?
            .query_row([id], |_| Ok(()))
            .optional()
            .map(|r| r.is_some())
    })
}

fn write_post_row(out: &mut Vec<u8>, row: &rusqlite::Row<'_>) -> rusqlite::Result<()> {
    let id: i64 = row.get(0)?;
    let body = row.get_ref(1)?.as_str()?;
    let created_at = row.get_ref(2)?.as_str()?;
    let author = row.get_ref(3)?.as_str()?;
    let likes: i64 = row.get(4)?;
    json::post(out, id, body, created_at, author, likes);
    Ok(())
}

// ---------------------------------------------------------------- writes (group commit)

pub enum Write {
    CreatePost { user_id: i64, body: String, reply: oneshot::Sender<rusqlite::Result<(i64, String)>> },
    Like { user_id: i64, post_id: i64, reply: oneshot::Sender<rusqlite::Result<bool>> },
}

static WRITER: std::sync::OnceLock<Sender<Write>> = std::sync::OnceLock::new();

pub fn start_writer() {
    let conn = open(false).expect("open database for writing");
    let (tx, rx) = crossbeam_channel::unbounded();
    WRITER.set(tx).ok().expect("writer started once");
    std::thread::Builder::new()
        .name("writer".into())
        .spawn(move || writer_loop(conn, rx))
        .expect("spawn writer");
}

pub async fn submit<T>(make: impl FnOnce(oneshot::Sender<rusqlite::Result<T>>) -> Write) -> rusqlite::Result<T> {
    let (tx, rx) = oneshot::channel();
    if WRITER.get().unwrap().send(make(tx)).is_err() {
        return Err(rusqlite::Error::InvalidQuery);
    }
    rx.await.unwrap_or(Err(rusqlite::Error::InvalidQuery))
}

const MAX_BATCH: usize = 512;

enum Done {
    Post(oneshot::Sender<rusqlite::Result<(i64, String)>>, rusqlite::Result<(i64, String)>),
    Like(oneshot::Sender<rusqlite::Result<bool>>, rusqlite::Result<bool>),
}

fn writer_loop(conn: Connection, rx: Receiver<Write>) {
    let mut batch: Vec<Write> = Vec::with_capacity(MAX_BATCH);
    let mut done: Vec<Done> = Vec::with_capacity(MAX_BATCH);
    while let Ok(first) = rx.recv() {
        batch.push(first);
        while batch.len() < MAX_BATCH {
            match rx.try_recv() {
                Ok(w) => batch.push(w),
                Err(_) => break,
            }
        }

        let began = conn.execute_batch("BEGIN IMMEDIATE");
        for w in batch.drain(..) {
            match w {
                Write::CreatePost { user_id, body, reply } => {
                    let r = began.as_ref().map_err(clone_err).and_then(|_| {
                        conn.prepare_cached("INSERT INTO posts (user_id, body) VALUES (?1, ?2) RETURNING id, created_at")?
                            .query_row(rusqlite::params![user_id, body], |r| Ok((r.get(0)?, r.get(1)?)))
                    });
                    done.push(Done::Post(reply, r));
                }
                Write::Like { user_id, post_id, reply } => {
                    let r = began.as_ref().map_err(clone_err).and_then(|_| {
                        conn.prepare_cached(
                            "INSERT INTO likes (user_id, post_id) VALUES (?1, ?2) ON CONFLICT (user_id, post_id) DO NOTHING",
                        )?
                        .execute([user_id, post_id])
                        .map(|n| n == 1)
                    });
                    done.push(Done::Like(reply, r));
                }
            }
        }

        // Nobody hears back until the whole batch is durable.
        let committed = began.and_then(|_| conn.execute_batch("COMMIT"));
        if committed.is_err() {
            let _ = conn.execute_batch("ROLLBACK");
        }
        for d in done.drain(..) {
            match d {
                Done::Post(tx, r) => {
                    let _ = tx.send(if let Err(e) = &committed { Err(clone_err(e)) } else { r });
                }
                Done::Like(tx, r) => {
                    let _ = tx.send(if let Err(e) = &committed { Err(clone_err(e)) } else { r });
                }
            }
        }
    }
}

fn clone_err(e: &rusqlite::Error) -> rusqlite::Error {
    rusqlite::Error::SqliteFailure(rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR), Some(e.to_string()))
}
