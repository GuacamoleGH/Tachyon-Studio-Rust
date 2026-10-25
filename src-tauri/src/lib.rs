use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::State;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FfmpegCapabilities {
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub has_nvenc: bool,
    pub has_qsv: bool,
    pub has_amf: bool,
    pub has_libx264: bool,
    pub recommended_encoder: Option<String>,
}

fn locate_ffmpeg_executable() -> Option<PathBuf> {
    // 1. Probar ruta relativa al ejecutable (sidecar empaquetado o carpeta bin/)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(dir) = exe_path.parent() {
            let candidates = [
                dir.join("ffmpeg.exe"),
                dir.join("bin").join("ffmpeg.exe"),
                dir.join("binaries").join("ffmpeg.exe"),
                dir.join("binaries").join("ffmpeg-x86_64-pc-windows-msvc.exe"),
            ];
            for c in candidates {
                if c.exists() {
                    return Some(c);
                }
            }
        }
    }

    // 2. Probar ruta de WinGet en el perfil de usuario de Windows
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let winget_link = Path::new(&local_appdata)
            .join("Microsoft")
            .join("WinGet")
            .join("Links")
            .join("ffmpeg.exe");
        if winget_link.exists() {
            return Some(winget_link);
        }
    }

    // 3. Probar ejecutable en PATH
    #[cfg(windows)]
    let mut check_cmd = std::process::Command::new("where");
    #[cfg(not(windows))]
    let mut check_cmd = std::process::Command::new("which");

    check_cmd.arg("ffmpeg");
    #[cfg(windows)]
    check_cmd.creation_flags(0x08000000);

    if let Ok(output) = check_cmd.output() {
        if output.status.success() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = out_str.lines().next() {
                let p = Path::new(first_line.trim());
                if p.exists() {
                    return Some(p.to_path_buf());
                }
            }
        }
    }

    None
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
        let zip_stem = Path::new(&zip_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("session");
        let target_path = temp_dir.join(format!("tachyon_{}_{}_{}", zip_stem, entry.size(), sanitized_name));

        if target_path.exists() {
            if let Ok(meta) = std::fs::metadata(&target_path) {
                if meta.len() == entry.size() && meta.len() > 0 {
                    return Ok(target_path.to_string_lossy().to_string());
                }
            }
        }

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

    #[tauri::command]
    pub fn detect_ffmpeg() -> FfmpegCapabilities {
        let ffmpeg_path = match locate_ffmpeg_executable() {
            Some(p) => p,
            None => {
                return FfmpegCapabilities {
                    available: false,
                    path: None,
                    version: None,
                    has_nvenc: false,
                    has_qsv: false,
                    has_amf: false,
                    has_libx264: false,
                    recommended_encoder: None,
                };
            }
        };

        let mut ver_cmd = std::process::Command::new(&ffmpeg_path);
        ver_cmd.arg("-version");
        #[cfg(windows)]
        ver_cmd.creation_flags(0x08000000);

        let version = if let Ok(output) = ver_cmd.output() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            out_str.lines().next().map(|s| s.to_string())
        } else {
            None
        };

        let mut enc_cmd = std::process::Command::new(&ffmpeg_path);
        enc_cmd.arg("-encoders");
        #[cfg(windows)]
        enc_cmd.creation_flags(0x08000000);

        let (has_nvenc, has_qsv, has_amf, has_libx264) = if let Ok(output) = enc_cmd.output() {
            let enc_str = String::from_utf8_lossy(&output.stdout);
            (
                enc_str.contains("h264_nvenc"),
                enc_str.contains("h264_qsv"),
                enc_str.contains("h264_amf"),
                enc_str.contains("libx264"),
            )
        } else {
            (false, false, false, false)
        };

        let recommended = if has_nvenc {
            Some("h264_nvenc".to_string())
        } else if has_qsv {
            Some("h264_qsv".to_string())
        } else if has_amf {
            Some("h264_amf".to_string())
        } else if has_libx264 {
            Some("libx264".to_string())
        } else {
            None
        };

        FfmpegCapabilities {
            available: true,
            path: Some(ffmpeg_path.to_string_lossy().to_string()),
            version,
            has_nvenc,
            has_qsv,
            has_amf,
            has_libx264,
            recommended_encoder: recommended,
        }
    }

    #[tauri::command]
    pub fn run_ffmpeg_command(args: Vec<String>) -> Result<String, String> {
        let ffmpeg_path = locate_ffmpeg_executable()
            .ok_or_else(|| "FFmpeg no encontrado en el sistema.".to_string())?;

        let mut cmd = std::process::Command::new(&ffmpeg_path);
        cmd.args(&args);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);

        let output = cmd
            .output()
            .map_err(|e| format!("Error ejecutando FFmpeg: {}", e))?;
        let stderr_str = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(format!("FFmpeg falló (código {:?}): {}", output.status.code(), stderr_str));
        }

        Ok(stderr_str)
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
            commands::detect_ffmpeg,
            commands::run_ffmpeg_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
