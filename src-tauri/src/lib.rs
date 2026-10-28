use std::collections::{HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::State;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Default)]
pub struct PathGrantState {
    pub allowed_paths: Mutex<HashSet<PathBuf>>,
}

impl PathGrantState {
    pub fn grant<P: AsRef<Path>>(&self, path: P) {
        if let Ok(mut set) = self.allowed_paths.lock() {
            let p = path.as_ref();
            let canon = dunce::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
            set.insert(canon);
        }
    }

    pub fn is_granted<P: AsRef<Path>>(&self, path: P) -> bool {
        let Ok(set) = self.allowed_paths.lock() else { return false };
        let p = path.as_ref();
        let target = dunce::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());

        for granted in set.iter() {
            if target == *granted || target.starts_with(granted) {
                return true;
            }
        }
        false
    }
}

pub fn validate_safe_audio_codec(codec: &str) -> Result<(), String> {
    const ALLOWED: &[&str] = &["copy", "aac", "pcm_s16le", "mp3"];
    if ALLOWED.contains(&codec) {
        Ok(())
    } else {
        Err(format!(
            "Códec de audio '{}' no permitido por política de seguridad.",
            codec
        ))
    }
}

pub fn is_app_generated_temp_path<P: AsRef<Path>>(path: P) -> bool {
    let p = path.as_ref();
    let temp_dir = std::env::temp_dir();
    let canon_temp = dunce::canonicalize(&temp_dir).unwrap_or(temp_dir);

    // Si el archivo existe o su padre existe dentro de temp
    let canon_p = dunce::canonicalize(p).unwrap_or_else(|_| {
        if let Some(parent) = p.parent() {
            if let Ok(canon_parent) = dunce::canonicalize(parent) {
                if let Some(file_name) = p.file_name() {
                    return canon_parent.join(file_name);
                }
            }
        }
        p.to_path_buf()
    });

    if canon_p.starts_with(&canon_temp) {
        if let Some(file_name) = canon_p.file_name().and_then(|f| f.to_str()) {
            return file_name.starts_with("tachyon_");
        }
    }
    false
}

pub fn validate_path(state: &PathGrantState, path_str: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path_str);
    if is_app_generated_temp_path(&p) || state.is_granted(&p) {
        Ok(p)
    } else {
        Err(format!(
            "Acceso denegado: la ruta '{}' no está autorizada por el usuario ni es un temporal de la aplicación.",
            path_str
        ))
    }
}

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
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum SafeFfmpegOp {
    Version,
    ExtractAudio {
        input_path: String,
        output_path: String,
        codec: String,
    },
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
    use tauri_plugin_dialog::DialogExt;

    #[tauri::command]
    pub fn grant_path_access(state: State<'_, PathGrantState>, path: String) -> Result<String, String> {
        state.grant(&path);
        Ok(path)
    }

    #[tauri::command]
    pub fn pick_file_dialog(
        app: tauri::AppHandle,
        state: State<'_, PathGrantState>,
        title: Option<String>,
        filters: Option<Vec<DialogFilter>>,
    ) -> Result<Option<String>, String> {
        let mut builder = app.dialog().file();
        if let Some(t) = title {
            builder = builder.set_title(t);
        }
        if let Some(filts) = filters {
            for f in filts {
                let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
                builder = builder.add_filter(f.name, &exts);
            }
        }
        let res = builder.blocking_pick_file();
        if let Some(file_path) = res {
            if let Ok(p) = file_path.into_path() {
                let canon = dunce::canonicalize(&p).unwrap_or(p);
                state.grant(&canon);
                return Ok(Some(canon.to_string_lossy().to_string()));
            }
        }
        Ok(None)
    }

    #[tauri::command]
    pub fn pick_files_dialog(
        app: tauri::AppHandle,
        state: State<'_, PathGrantState>,
        title: Option<String>,
        filters: Option<Vec<DialogFilter>>,
    ) -> Result<Option<Vec<String>>, String> {
        let mut builder = app.dialog().file();
        if let Some(t) = title {
            builder = builder.set_title(t);
        }
        if let Some(filts) = filters {
            for f in filts {
                let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
                builder = builder.add_filter(f.name, &exts);
            }
        }
        let res = builder.blocking_pick_files();
        if let Some(file_paths) = res {
            let mut list = Vec::new();
            for file_path in file_paths {
                if let Ok(p) = file_path.into_path() {
                    let canon = dunce::canonicalize(&p).unwrap_or(p);
                    state.grant(&canon);
                    list.push(canon.to_string_lossy().to_string());
                }
            }
            return Ok(Some(list));
        }
        Ok(None)
    }

    #[tauri::command]
    pub fn pick_save_file_dialog(
        app: tauri::AppHandle,
        state: State<'_, PathGrantState>,
        title: Option<String>,
        default_path: Option<String>,
        filters: Option<Vec<DialogFilter>>,
    ) -> Result<Option<String>, String> {
        let mut builder = app.dialog().file();
        if let Some(t) = title {
            builder = builder.set_title(t);
        }
        if let Some(dp) = default_path {
            builder = builder.set_file_name(dp);
        }
        if let Some(filts) = filters {
            for f in filts {
                let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
                builder = builder.add_filter(f.name, &exts);
            }
        }
        let res = builder.blocking_save_file();
        if let Some(file_path) = res {
            if let Ok(p) = file_path.into_path() {
                // Para save, el archivo puede no existir aún, concedemos la ruta directa y su directorio padre
                if let Some(parent) = p.parent() {
                    let canon_parent = dunce::canonicalize(parent).unwrap_or_else(|_| parent.to_path_buf());
                    state.grant(&canon_parent);
                }
                state.grant(&p);
                return Ok(Some(p.to_string_lossy().to_string()));
            }
        }
        Ok(None)
    }

    #[tauri::command]
    pub fn get_file_info(grant_state: State<'_, PathGrantState>, path: String) -> Result<FileInfo, String> {
        let p = validate_path(&grant_state, &path)?;
        if !p.exists() {
            return Ok(FileInfo {
                exists: false,
                size: 0,
                is_file: false,
            });
        }

        match std::fs::metadata(&p) {
            Ok(meta) => Ok(FileInfo {
                exists: true,
                size: meta.len(),
                is_file: meta.is_file(),
            }),
            Err(e) => Err(format!("Error leyendo metadatos de archivo: {}", e)),
        }
    }

    #[tauri::command]
    pub fn read_file_range(
        grant_state: State<'_, PathGrantState>,
        path: String,
        offset: u64,
        length: usize,
    ) -> Result<tauri::ipc::Response, String> {
        let p = validate_path(&grant_state, &path)?;
        let mut file = File::open(&p).map_err(|e| format!("No se pudo abrir el archivo '{}': {}", path, e))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|e| format!("Fallo al posicionar seek en offset {}: {}", offset, e))?;

        let mut buffer = vec![0u8; length];
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("Error leyendo bytes del archivo: {}", e))?;

        buffer.truncate(bytes_read);
        Ok(tauri::ipc::Response::new(buffer))
    }

    #[tauri::command]
    pub fn open_stream_writer(
        state: State<'_, StreamWriterState>,
        grant_state: State<'_, PathGrantState>,
        path: String,
    ) -> Result<u32, String> {
        let p = validate_path(&grant_state, &path)?;
        if let Some(parent) = p.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&p)
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
    pub fn write_stream_chunk_raw(
        state: State<'_, StreamWriterState>,
        request: tauri::ipc::Request<'_>,
    ) -> Result<(), String> {
        let headers = request.headers();
        let handle_id: u32 = headers
            .get("x-handle-id")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse().ok())
            .ok_or_else(|| "Header 'x-handle-id' ausente o inválido".to_string())?;

        let position: u64 = headers
            .get("x-position")
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.parse().ok())
            .ok_or_else(|| "Header 'x-position' ausente o inválido".to_string())?;

        let chunk = match request.body() {
            tauri::ipc::InvokeBody::Raw(bytes) => bytes.as_slice(),
            _ => return Err("El cuerpo de la solicitud no es binario raw".to_string()),
        };

        let mut writers = state.writers.lock().map_err(|e| e.to_string())?;
        let file = writers
            .get_mut(&handle_id)
            .ok_or_else(|| format!("Descriptor de escritura #{} no encontrado o cerrado", handle_id))?;

        file.seek(SeekFrom::Start(position))
            .map_err(|e| format!("Fallo en seek({}) de descriptor #{}: {}", position, handle_id, e))?;

        file.write_all(chunk)
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
    pub fn inspect_zip_session(
        grant_state: State<'_, PathGrantState>,
        zip_path: String,
    ) -> Result<ZipSessionInspection, String> {
        let p = validate_path(&grant_state, &zip_path)?;
        let file = File::open(&p)
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
    pub fn extract_zip_video_to_temp(
        grant_state: State<'_, PathGrantState>,
        zip_path: String,
        entry_name: String,
    ) -> Result<String, String> {
        let p = validate_path(&grant_state, &zip_path)?;
        let file = File::open(&p)
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
                    grant_state.grant(&target_path);
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

        grant_state.grant(&target_path);
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
        if args.len() == 1 && args[0] == "-version" {
            let ffmpeg_path = locate_ffmpeg_executable()
                .ok_or_else(|| "FFmpeg no encontrado en el sistema.".to_string())?;

            let mut cmd = std::process::Command::new(&ffmpeg_path);
            cmd.arg("-version");
            #[cfg(windows)]
            cmd.creation_flags(0x08000000);

            let output = cmd
                .output()
                .map_err(|e| format!("Error ejecutando FFmpeg: {}", e))?;
            return Ok(String::from_utf8_lossy(&output.stdout).to_string());
        }

        Err("La ejecución de comandos FFmpeg con argumentos arbitrarios ha sido deshabilitada por seguridad. Utilice operaciones específicas como execute_safe_ffmpeg.".to_string())
    }

    #[tauri::command]
    pub fn execute_safe_ffmpeg(
        grant_state: State<'_, PathGrantState>,
        op: SafeFfmpegOp,
    ) -> Result<String, String> {
        let ffmpeg_path = locate_ffmpeg_executable()
            .ok_or_else(|| "FFmpeg no encontrado en el sistema.".to_string())?;

        match op {
            SafeFfmpegOp::Version => {
                let mut cmd = std::process::Command::new(&ffmpeg_path);
                cmd.arg("-version");
                #[cfg(windows)]
                cmd.creation_flags(0x08000000);

                let output = cmd
                    .output()
                    .map_err(|e| format!("Error ejecutando FFmpeg: {}", e))?;
                if !output.status.success() {
                    return Err("Fallo al consultar la versión de FFmpeg".to_string());
                }
                Ok(String::from_utf8_lossy(&output.stdout).to_string())
            }
            SafeFfmpegOp::ExtractAudio {
                input_path,
                output_path,
                codec,
            } => {
                let in_p = validate_path(&grant_state, &input_path)?;
                let out_p = validate_path(&grant_state, &output_path)?;

                validate_safe_audio_codec(&codec)?;

                let mut cmd = std::process::Command::new(&ffmpeg_path);
                cmd.args([
                    "-y",
                    "-i",
                    &in_p.to_string_lossy(),
                    "-vn",
                    "-c:a",
                    &codec,
                    &out_p.to_string_lossy(),
                ]);
                #[cfg(windows)]
                cmd.creation_flags(0x08000000);

                let output = cmd
                    .output()
                    .map_err(|e| format!("Error ejecutando FFmpeg: {}", e))?;
                if !output.status.success() {
                    let stderr_str = String::from_utf8_lossy(&output.stderr).to_string();
                    return Err(format!("FFmpeg falló al extraer audio: {}", stderr_str));
                }
                Ok(String::from_utf8_lossy(&output.stderr).to_string())
            }
        }
    }

    #[tauri::command]
    pub fn concatenate_videos(
        grant_state: State<'_, PathGrantState>,
        inputs: Vec<String>,
        output_path: String,
    ) -> Result<String, String> {
        if inputs.is_empty() {
            return Err("No se han seleccionado archivos de vídeo para unir.".to_string());
        }

        let mut validated_inputs = Vec::with_capacity(inputs.len());
        for input in &inputs {
            let p = validate_path(&grant_state, input)?;
            validated_inputs.push(p);
        }
        let validated_output = validate_path(&grant_state, &output_path)?;

        if validated_inputs.len() == 1 {
            std::fs::copy(&validated_inputs[0], &validated_output)
                .map_err(|e| format!("Error al copiar el archivo: {}", e))?;
            return Ok("Archivo único copiado con éxito.".to_string());
        }

        let ffmpeg_path = locate_ffmpeg_executable().ok_or_else(|| {
            "FFmpeg no está disponible en el sistema. Asegúrate de tener FFmpeg instalado para unir vídeos sin pérdida.".to_string()
        })?;

        let temp_dir = std::env::temp_dir();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let list_path = temp_dir.join(format!("tachyon_gopro_concat_{}.txt", timestamp));

        {
            let mut list_file = File::create(&list_path)
                .map_err(|e| format!("No se pudo crear el archivo temporal de lista: {}", e))?;

            for input in &validated_inputs {
                let forward = input.to_string_lossy().replace('\\', "/").replace('\'', "'\\''");
                writeln!(list_file, "file '{}'", forward)
                    .map_err(|e| format!("Error al escribir en la lista temporal: {}", e))?;
            }
            list_file
                .sync_all()
                .map_err(|e| format!("Error sincronizando lista temporal: {}", e))?;
        }

        let mut cmd = std::process::Command::new(&ffmpeg_path);
        cmd.args([
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", &list_path.to_string_lossy(),
            "-c", "copy",
            "-movflags", "+faststart",
            &validated_output.to_string_lossy(),
        ]);

        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd.output().map_err(|e| {
            let _ = std::fs::remove_file(&list_path);
            format!("Error al ejecutar FFmpeg: {}", e)
        })?;

        let _ = std::fs::remove_file(&list_path);

        if !output.status.success() {
            let stderr_str = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("FFmpeg falló al unir los vídeos: {}", stderr_str));
        }

        Ok("Vídeos unidos con éxito sin pérdida de calidad.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(StreamWriterState::default())
        .manage(PathGrantState::default())
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
            commands::grant_path_access,
            commands::pick_file_dialog,
            commands::pick_files_dialog,
            commands::pick_save_file_dialog,
            commands::get_file_info,
            commands::read_file_range,
            commands::open_stream_writer,
            commands::write_stream_chunk,
            commands::write_stream_chunk_raw,
            commands::close_stream_writer,
            commands::inspect_zip_session,
            commands::extract_zip_video_to_temp,
            commands::detect_ffmpeg,
            commands::run_ffmpeg_command,
            commands::execute_safe_ffmpeg,
            commands::concatenate_videos,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unauthorized_path_is_rejected() {
        let state = PathGrantState::default();
        let forbidden = if cfg!(windows) {
            "C:\\Windows\\System32\\drivers\\etc\\hosts"
        } else {
            "/etc/passwd"
        };
        let result = validate_path(&state, forbidden);
        assert!(result.is_err(), "Ruta no autorizada debió ser rechazada");
    }

    #[test]
    fn test_granted_path_is_allowed() {
        let state = PathGrantState::default();
        let temp_dir = std::env::temp_dir();
        let my_file = temp_dir.join("test_user_selected_session.zip");
        // Registrar en el estado como si el usuario lo hubiera seleccionado
        state.grant(&my_file);

        let result = validate_path(&state, &my_file.to_string_lossy());
        assert!(result.is_ok(), "Ruta concedida explícitamente debe ser aceptada");
    }

    #[test]
    fn test_app_generated_temp_file_is_allowed_automatically() {
        let state = PathGrantState::default();
        let temp_dir = std::env::temp_dir();
        let temp_video = temp_dir.join("tachyon_extracted_video_1234.mp4");

        let result = validate_path(&state, &temp_video.to_string_lossy());
        assert!(
            result.is_ok(),
            "Archivo temporal con prefijo tachyon_ en temp_dir debe ser admitido automáticamente"
        );
    }

    #[test]
    fn test_non_app_temp_file_rejected_without_grant() {
        let state = PathGrantState::default();
        let temp_dir = std::env::temp_dir();
        let random_file = temp_dir.join("arbitrary_other_app_file.txt");

        let result = validate_path(&state, &random_file.to_string_lossy());
        assert!(
            result.is_err(),
            "Archivo en temp_dir sin prefijo tachyon_ debe ser rechazado sin concesión previa"
        );
    }

    #[test]
    fn test_run_ffmpeg_command_rejects_arbitrary_args() {
        let bad_args = vec!["-i".to_string(), "input.mp4".to_string(), "output.mp4".to_string()];
        let res = commands::run_ffmpeg_command(bad_args);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("deshabilitada por seguridad"));
    }

    #[test]
    fn test_safe_audio_codec_whitelist() {
        assert!(validate_safe_audio_codec("copy").is_ok());
        assert!(validate_safe_audio_codec("aac").is_ok());
        assert!(validate_safe_audio_codec("pcm_s16le").is_ok());
        assert!(validate_safe_audio_codec("mp3").is_ok());

        assert!(validate_safe_audio_codec("malicious_codec").is_err());
        assert!(validate_safe_audio_codec("; rm -rf /").is_err());
        assert!(validate_safe_audio_codec("h264").is_err());
    }
}
