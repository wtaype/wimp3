import './convertidor.css';
import $ from 'jquery';
import { Mensaje, wiSpin } from '../widev.js';

// ✅ DETECCIÓN DINÁMICA EN RUNTIME (se evalúa en el navegador del usuario)
const API = (() => {
  if (typeof window === 'undefined') return '';
  return window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : window.location.origin;
})();

let files = [];
let bitrate = '128k';

export const render = () => `
  <div class="wimp3_container">
    <div class="wimp3_header">
      <div class="wimp3_title_section">
        <h1 class="wimp3_title"><i class="fas fa-video"></i> Convertidor de Video a MP3</h1>
        <p class="wimp3_subtitle">Arrastra tus videos o haz clic para seleccionar</p>
      </div>
      <div class="wimp3_quality">
        <label><i class="fas fa-sliders-h"></i> Calidad:</label>
        <select id="qualitySelect">
          <option value="128k" selected>128 kbps (Estándar)</option>
          <option value="192k">192 kbps (Alta)</option>
          <option value="256k">256 kbps (Muy Alta)</option>
          <option value="320k">320 kbps (Máxima)</option>
        </select>
      </div>
    </div>

    <div class="wimp3_upload_zone dfcc" id="dropZone">
      <i class="fas fa-cloud-upload-alt"></i>
      <p>Arrastra y suelta videos aquí</p>
      <span>o haz clic para seleccionar</span>
      <input type="file" id="fileInput" accept="video/*" hidden>
    </div>

    <div class="wimp3_files_container" id="filesContainer" style="display:none;">
      <div class="wimp3_files_header">
        <h3><i class="fas fa-list"></i> Archivo listo para convertir</h3>
        <div class="wimp3_actions">
          <button class="wimp3_btn_convert" id="convertBtn"><i class="fas fa-sync"></i> Convertir</button>
          <button class="wimp3_btn_clear" id="clearBtn"><i class="fas fa-trash"></i> Eliminar</button>
        </div>
      </div>
      <table class="wimp3_table">
        <thead>
          <tr>
            <th><i class="far fa-calendar"></i> Fecha</th>
            <th><i class="fas fa-video"></i> Video</th>
            <th><i class="fas fa-chart-line"></i> Progreso</th>
            <th><i class="fas fa-music"></i> MP3</th>
          </tr>
        </thead>
        <tbody id="filesList"></tbody>
      </table>
    </div>
  </div>
`;

export const init = () => {
  const $dropZone = $('#dropZone');
  const $fileInput = $('#fileInput');
  const $filesContainer = $('#filesContainer');
  const $filesList = $('#filesList');
  const $convertBtn = $('#convertBtn');
  const $clearBtn = $('#clearBtn');
  const $qualitySelect = $('#qualitySelect');

  $qualitySelect.on('change', e => bitrate = e.target.value);
  $dropZone.on('click', () => $fileInput[0].click());

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => 
    $dropZone.on(ev, e => { e.preventDefault(); e.stopPropagation(); })
  );
  ['dragenter', 'dragover'].forEach(ev => $dropZone.on(ev, () => $dropZone.addClass('dragover')));
  ['dragleave', 'drop'].forEach(ev => $dropZone.on(ev, () => $dropZone.removeClass('dragover')));

  $dropZone.on('drop', e => {
    const file = e.originalEvent.dataTransfer.files[0];
    if (file?.type.startsWith('video/')) addFile(file);
    else Mensaje('Solo se permiten videos', 'warning');
  });

  $fileInput.on('change', e => {
    const file = e.target.files[0];
    if (file) addFile(file);
  });

  const addFile = file => {
    if (files.length > 0) return Mensaje('Solo 1 video a la vez', 'warning');
    files = [{ file, id: Date.now(), status: 'pending', progress: 0 }];
    renderFiles();
    $filesContainer.show();
    $dropZone.hide();
  };

  const renderFiles = () => {
    $filesList.html(files.map(f => `
      <tr data-id="${f.id}">
        <td class="compact-date">${new Date().toLocaleString('es-PE', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',', '')}</td>
        <td class="compact-file">
          <i class="fas fa-file-video"></i>
          <span class="file-name">${f.file.name}</span>
          <span class="file-size">(${(f.file.size/1024/1024).toFixed(1)} MB)</span>
        </td>
        <td class="compact-progress">
          ${f.status === 'done' ? '<i class="fas fa-check-circle check-icon"></i>' : `<span class="progress-percent">${f.progress}%</span>`}
        </td>
        <td class="compact-download">
          ${f.downloadUrl ? `<a href="${API}${f.downloadUrl}" download class="download-link"><i class="fas fa-download"></i> ${f.outputName}</a>` : '—'}
        </td>
      </tr>
    `).join(''));
  };

  $clearBtn.on('click', () => {
    files = [];
    $filesContainer.hide();
    $dropZone.show();
    $fileInput.val('');
  });

  $convertBtn.on('click', async () => {
    const pending = files.filter(f => f.status === 'pending');
    if (!pending.length) return Mensaje('No hay archivos pendientes', 'warning');

    wiSpin($convertBtn, true, 'Convirtiendo');
    $convertBtn.prop('disabled', true);

    for (const file of pending) {
      file.status = 'converting';
      file.progress = 0;
      renderFiles();

      const fd = new FormData();
      fd.append('video', file.file);

      try {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) {
            file.progress = Math.round((e.loaded / e.total) * 50);
            renderFiles();
          }
        });

        const response = await new Promise((resolve, reject) => {
          xhr.open('POST', `${API}/convert`);
          xhr.onload = () => xhr.status === 200 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`Error ${xhr.status}`));
          xhr.onerror = () => reject(new Error('Error de conexión'));
          xhr.send(fd);
        });

        if (response.success) {
          file.status = 'done';
          file.progress = 100;
          file.downloadUrl = response.downloadUrl;
          file.outputName = `${file.file.name.split('.')[0]}.mp3`;
          Mensaje('✓ Conversión exitosa', 'success');
        } else {
          throw new Error(response.error || 'Error en conversión');
        }
      } catch (e) {
        file.status = 'error';
        file.progress = 0;
        Mensaje(`✗ ${e.message}`, 'error');
      }

      renderFiles();
    }

    wiSpin($convertBtn, false);
    $convertBtn.prop('disabled', false);
  });
};

export const cleanup = () => {
  $('#dropZone, #fileInput, #convertBtn, #clearBtn, #qualitySelect').off();
  files = [];
};