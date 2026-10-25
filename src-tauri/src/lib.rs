use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct StreamWriterState {
    next_id: AtomicU32,
    writers: Mutex<HashMap<u32, File>>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ZipVideoEntryInfo {
    pub entry_name: String,
    pub is_stored: bool,
    pub data_offset: u64,
    pub size: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ZipSessionInspection {
    pub valid_session: bool,
    pub session_json: Option<String>,
    pub telemetria_csv: Option<String>,
    pub ruta_gpx: Option<String>,
    pub video_entry: Option<ZipVideoEntryInfo>,
    pub error_message: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FileInfo {
    pub exists: bool,
    pub size: u64,
    pub is_file: bool,
}

mod commands {
    use super::*;

    #[tauri::command]
    pub fn get_file_info(path: String) -> Result<FileInfo, String> {
        let p = Path::new(&path);
        if !p.exists() {
            return Ok(FileInfo {
                exists: false,
                size: 0,
                is_file: false,
            });
        }

        match std::fs::metadata(p) {
            Ok(meta) => Ok(FileInfo {
                exists: true,
                size: meta.len(),
                is_file: meta.is_file(),
            }),
            Err(e) => Err(format!("Error leyendo metadatos de archivo: {}", e)),
        }
    }

    #[tauri::command]
    pub fn read_file_range(path: String, offset: u64, length: usize) -> Result<Vec<u8>, String> {
        let mut file = File::open(&path).map_err(|e| format!("No se pudo abrir el archivo '{}': {}", path, e))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| format!("Fallo al posicionar seek en offset {}: {}", offset, e))?;

        let mut buffer = vec![0u8; length];
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("Error leyendo bytes del archivo: {}", e))?;

        buffer.truncate(bytes_read);
        Ok(buffer)
    }

    #[tauri::command]
    pub fn open_stream_writer(state: State<'_, StreamWriterState>, path: String) -> Result<u32, String> {
        if let Some(parent) = Path::new(&path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&path)
            .map_err(|e| format!("No se pudo crear el archivo de salida '{}': {}", path, e))?;

        let id = state.next_id.fetch_add(1, Ordering::SeqCst) + 1;
        let mut writers = state.writers.lock().map_err(|e| e.to_string())?;
        writers.insert(id, file);

        Ok(id)
    }

    #[tauri::command]
    pub fn write_stream_chunk(
        state: State<'_, StreamWriterState>,
        handle_id: u32,
        position: u64,
        chunk: Vec<u8>,
    ) -> Result<(), String> {
        let mut writers = state.writers.lock().map_err(|e| e.to_string())?;
        let file = writers
            .get_mut(&handle_id)
            .ok_or_else(|| format!("Descriptor de escritura #{} no encontrado o cerrado", handle_id))?;

        file.seek(SeekFrom::Start(position))
            .map_err(|e| format!("Fallo en seek({}) de descriptor #{}: {}", position, handle_id, e))?;

        file.write_all(&chunk)
            .map_err(|e| format!("Fallo al escribir {} bytes en #{}: {}", chunk.len(), handle_id, e))?;

        Ok(())
    }

    #[tauri::command]
    pub fn close_stream_writer(state: State<'_, StreamWriterState>, handle_id: u32) -> Result<(), String> {
        let mut writers = state.writers.lock().map_err(|e| e.to_string())?;
        if let Some(file) = writers.remove(&handle_id) {
            file.sync_all()
                .map_err(|e| format!("Error al sincronizar archivo #{}: {}", handle_id, e))?;
        }
        Ok(())
    }

    #[tauri::command]
    pub fn inspect_zip_session(zip_path: String) -> Result<ZipSessionInspection, String> {
        let file = File::open(&zip_path)
            .map_err(|e| format!("No se pudo abrir el archivo ZIP '{}': {}", zip_path, e))?;

        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| format!("El archivo seleccionado no es un contenedor ZIP válido: {}", e))?;

        let mut session_json: Option<String> = None;
        let mut telemetria_csv: Option<String> = None;
        let mut ruta_gpx: Option<String> = None;
        let mut video_entry: Option<ZipVideoEntryInfo> = None;

        for i in 0..archive.len() {
            let mut entry = match archive.by_index(i) {
                Ok(e) => e,
                Err(_) => continue,
            };

            let name = entry.name().to_string();
            let lower = name.to_lowercase();

            if lower.ends_with("session.json") {
                let mut s = String::new();
                if entry.read_to_string(&mut s).is_ok() {
                    session_json = Some(s);
                }
            } else if lower.ends_with("telemetria.csv") {
                let mut s = String::new();
                if entry.read_to_string(&mut s).is_ok() {
                    telemetria_csv = Some(s);
                }
            } else if lower.ends_with("ruta.gpx") {
                let mut s = String::new();
                if entry.read_to_string(&mut s).is_ok() {
                    ruta_gpx = Some(s);
                }
            } else if lower.ends_with(".mp4")
                || lower.ends_with(".mov")
                || lower.ends_with(".mkv")
                || lower.ends_with(".webm")
            {
                let is_stored = entry.compression() == zip::CompressionMethod::Stored;
                let data_offset = entry.data_start();
                let size = entry.size();

                video_entry = Some(ZipVideoEntryInfo {
                    entry_name: name,
                    is_stored,
                    data_offset,
                    size,
                });
            }
        }

        let has_required = telemetria_csv.is_some() || session_json.is_some();

        Ok(ZipSessionInspection {
            valid_session: has_required,
            session_json,
            telemetria_csv,
            ruta_gpx,
            video_entry,
            error_message: if has_required {
                None
            } else {
                Some("El archivo ZIP no contiene 'telemetria.csv' ni 'session.json'.".into())
            },
        })
    }

    #[tauri::command]
    pub fn extract_zip_video_to_temp(zip_path: String, entry_name: String) -> Result<String, String> {
        let file = File::open(&zip_path)
            .map_err(|e| format!("No se pudo abrir el archivo ZIP: {}", e))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| format!("Error leyendo ZIP: {}", e))?;

        let mut entry = archive
            .by_name(&entry_name)
            .map_err(|e| format!("Entrada '{}' no encontrada en el ZIP: {}", entry_name, e))?;

        let temp_dir = std::env::temp_dir();
        let sanitized_name = Path::new(&entry_name)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("extracted_video.mp4");
        let target_path = temp_dir.join(format!("tachyon_stream_{}", sanitized_name));

        let mut out_file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&target_path)
            .map_err(|e| format!("No se pudo crear archivo temporal: {}", e))?;

        let mut buffer = vec![0u8; 1024 * 1024]; // 1 MB buffer para streaming de descompresión
        loop {
            let bytes_read = entry
                .read(&mut buffer)
                .map_err(|e| format!("Error descomprimiendo entrada de vídeo: {}", e))?;
            if bytes_read == 0 {
                break;
            }
            out_file
                .write_all(&buffer[..bytes_read])
                .map_err(|e| format!("Error escribiendo en archivo temporal: {}", e))?;
        }

        out_file
            .sync_all()
            .map_err(|e| format!("Error sincronizando archivo temporal: {}", e))?;

        Ok(target_path.to_string_lossy().to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(StreamWriterState::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_file_info,
            commands::read_file_range,
            commands::open_stream_writer,
            commands::write_stream_chunk,
            commands::close_stream_writer,
            commands::inspect_zip_session,
            commands::extract_zip_video_to_temp,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
