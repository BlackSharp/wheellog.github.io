// Обработчик загрузки CSV файла
document.getElementById('csvFile').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const text = event.target.result;
    const data = d3.csvParse(text);

    // Очистка старых графиков и карты перед отрисовкой
    clearPreviousData();

    // Проверка на ошибки в данных
    const invalidRows = validateData(data);

    // Отображение сводки и графика
    renderSummary(data);
    renderChart(data);
    renderMap(data);

    // Отображение информации о некорректных данных
    displayInvalidData(invalidRows);
  };
  reader.readAsText(file);
});

// Очистка старых данных (графики, карта, ошибки)
function clearPreviousData() {
  document.getElementById('chart').innerHTML = '';
  document.getElementById('map').innerHTML = '';
  const invalidDataContainer = document.querySelector('.invalid-data');
  if (invalidDataContainer) {
    invalidDataContainer.remove();
  }
}

// Функция для проверки и фильтрации некорректных данных
function validateData(data) {
  const invalidRows = [];

  data.forEach((row, index) => {
    const rowErrors = [];

    if (parseFloat(row.battery_level) < 0 || parseFloat(row.battery_level) > 100) {
      rowErrors.push(`Battery = ${row.battery_level}`);
    }
    if (parseFloat(row.system_temp) < -50 || parseFloat(row.system_temp) > 100) {
      rowErrors.push(`Temperature = ${row.system_temp}`);
    }

    if (rowErrors.length > 0) {
      invalidRows.push({ index: index + 1, errors: rowErrors.join(', ') });
    }
  });

  return invalidRows;
}

// Функция для отображения информации о некорректных данных
function displayInvalidData(invalidRows) {
  if (invalidRows.length > 0) {
    const invalidRowsHtml = invalidRows.map(row => {
      return `<p>Неверные данные в строке ${row.index}: ${row.errors}</p>`;
    }).join('');
    document.getElementById('map').insertAdjacentHTML('afterend', `<div class="invalid-data">${invalidRowsHtml}</div>`);
  }
}

// Функция для отображения сводной информации о поездке
function renderSummary(data) {
  const start = data[0];
  const end = data[data.length - 1];
  const parseNumber = (val) => parseFloat(val) || 0;

  if (!start || !end) {
    console.error('Не удалось определить начальные и конечные данные.');
    return;
  }

  const distance = (parseNumber(end.totaldistance) - parseNumber(start.totaldistance)) / 1000;
  const startTime = dayjs(`${start.date} ${start.time}`);
  const endTime = dayjs(`${end.date} ${end.time}`);
  const duration = endTime.diff(startTime, 'seconds');
  const durationStr = `${Math.floor(duration / 3600)} hours ${Math.floor((duration % 3600) / 60)} minutes ${duration % 60} seconds`;

  // Функция для получения статистики по различным полям
  function getStats(field, suffix = '', factor = 1) {
    const values = data.map(d => parseNumber(d[field]) * factor).filter(n => !isNaN(n));
    values.sort((a, b) => a - b);

    if (values.length === 0) return { max: '-', min: '-', avg: '-', median: '-' };

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const median = values.length % 2
      ? values[Math.floor(values.length / 2)]
      : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;

    return {
      max: Math.max(...values).toFixed(1) + suffix,
      min: Math.min(...values).toFixed(1) + suffix,
      avg: avg.toFixed(1) + suffix,
      median: median.toFixed(1) + suffix
    };
  }

  const summaryHtml = generateSummaryHtml(distance, durationStr, startTime, endTime, start, end, getStats);
  document.getElementById('summary').innerHTML = summaryHtml;
}

// Функция для генерации HTML-сводки
function generateSummaryHtml(distance, durationStr, startTime, endTime, start, end, getStats) {
  return `
    <div class="summary-container">
      <p>${distance.toFixed(1)} km<br>in ${durationStr}</p>
    </div>
    <div class="stats-container">
      ${generateStatBlock('START & FINISH', [
        `START: ${startTime.format('D MMMM YYYY HH:mm')}`,
        `FINISH: ${endTime.format('D MMMM YYYY HH:mm')}`,
        `MILEAGE: ${(parseFloat(start.totaldistance) / 1000).toFixed(1)} km → ${(parseFloat(end.totaldistance) / 1000).toFixed(1)} km`
      ])}
      ${generateStatBlock('PWM', [
        `Max: ${getStats('pwm').max}`,
        `Avg: ${getStats('pwm').avg}`,
        `Median: ${getStats('pwm').median}`
      ])}
      ${generateStatBlock('SPEED', [
        `Max: ${getStats('speed', ' km/h').max}`,
        `Avg: ${getStats('speed', ' km/h').avg}`,
        `Median: ${getStats('speed', ' km/h').median}`
      ])}
      ${generateStatBlock('POWER', [
        `Max: ${getStats('power', ' W').max}`,
        `Avg: ${getStats('power', ' W').avg}`,
        `Median: ${getStats('power', ' W').median}`
      ])}
      ${generateStatBlock('CURRENT', [
        `Max: ${getStats('current', ' A').max}`,
        `Avg: ${getStats('current', ' A').avg}`,
        `Median: ${getStats('current', ' A').median}`
      ])}
      ${generateStatBlock('VOLTAGE', [
        `Max: ${getStats('voltage', ' V').max}`,
        `Min: ${getStats('voltage', ' V').min}`,
        `Avg: ${getStats('voltage', ' V').avg}`,
        `Median: ${getStats('voltage', ' V').median}`
      ])}
      ${generateStatBlock('BATTERY', [
        `Max: ${getStats('battery_level', ' %').max}`,
        `Min: ${getStats('battery_level', ' %').min}`,
        `Avg: ${getStats('battery_level', ' %').avg}`,
        `Median: ${getStats('battery_level', ' %').median}`
      ])}
      ${generateStatBlock('TEMPERATURE', [
        `Max: ${getStats('system_temp', ' °C').max}`,
        `Min: ${getStats('system_temp', ' °C').min}`,
        `Avg: ${getStats('system_temp', ' °C').avg}`,
        `Median: ${getStats('system_temp', ' °C').median}`
      ])}
    </div>
  `;
}

// Функция для генерации блока статистики
function generateStatBlock(title, stats) {
  return `
    <div class="stat-block">
      <h3>${title}</h3>
      ${stats.map(stat => `<p>${stat}</p>`).join('')}
    </div>
  `;
}

// Функция для отображения графика
function renderChart(data) {
  const timeLabels = data.map(d => `${d.date} ${d.time}`);
  const parseField = field => data.map(d => parseFloat(d[field]) || 0);

  function normalize(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    return arr.map(v => (v - min) / (max - min));
  }

  const traces = [
    {field: 'speed', name: 'Speed (km/h)', color: '#1f77b4'},   // Синий
    {field: 'gps_speed', name: 'GPS Speed (km/h)', color: '#ff7f0e', visible: 'legendonly'}, // Оранжевый
    {field: 'power', name: 'Power (W)', color: '#2ca02c'},     // Зеленый
    {field: 'current', name: 'Current (A)', color: '#d62728'},  // Красный
    {field: 'voltage', name: 'Voltage (V)', color: '#9467bd'},  // Пурпурный
    {field: 'battery_level', name: 'Battery (%)', color: '#8c564b'},  // Коричневый
    {field: 'system_temp', name: 'Temperature (°C)', color: '#e377c2'}, // Розовый
    {field: 'pwm', name: 'PWM (%)', color: '#17becf'}          // Бирюзовый
  ].map(trace => {
    const raw = parseField(trace.field);
    return {
      x: timeLabels,
      y: normalize(raw),
      text: raw.map(v => `${v.toFixed(1)} ${trace.name.split(' ')[1]}`),
      hovertemplate: `${trace.name}: %{text}<extra></extra>`,
      type: 'scattergl',
      mode: 'lines',
      name: trace.name,
      line: {
        color: trace.color // Устанавливаем цвет для каждой линии
      }
    };
  });
  
  // Удаляем старый listener перед новой отрисовкой (чтобы не дублировать)
  if (window.chartDiv && window.chartDiv.removeAllListeners) {
    window.chartDiv.removeAllListeners('plotly_hover');
  }

  window.chartDiv = document.getElementById('chart');
  Plotly.newPlot(
    window.chartDiv,
    traces,
    {
      margin: {t: 30},
      xaxis: {title: 'Time', automargin: true},
      yaxis: {title: 'Normalized', automargin: true},
      legend: {orientation: 'h'},
      hovermode: 'x unified'
    },
    {responsive: true}
  );

  // Вешаем hover-событие для обновления маркера на карте
  window.chartDiv.on('plotly_hover', function (event) {
    const idx = event.points[0].pointIndex;
    updateMapMarker(data[idx].latitude, data[idx].longitude);
  });
}

// Функция для отображения карты
function renderMap(data) {
  const mapContainer = document.getElementById('map');
  if (window.mapInstance) {
    window.mapInstance.remove();
    window.mapInstance = null;
    window.marker = null;
    window.latlngs = null;
  }

  mapContainer.innerHTML = '';

  const latlngs = data
    .filter(d => d.latitude && d.longitude)
    .map(d => [parseFloat(d.latitude), parseFloat(d.longitude)]);

  if (latlngs.length === 0) {
    console.error('Нет координат для построения карты.');
    mapContainer.innerHTML = '<p style="color:red;text-align:center;">В файле отсутствуют GPS данные.</p>';
    return;
  }

  window.latlngs = latlngs;
  initializeMap(latlngs);
}

// Инициализация карты
function initializeMap(latlngs) {
  const map = L.map('map').setView(latlngs[0], 13);
  window.mapInstance = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const polyline = L.polyline(latlngs, {color: 'blue'}).addTo(map);
  map.fitBounds(polyline.getBounds());

  window.marker = L.marker(latlngs[0]).addTo(map);
}

// Функция для обновления маркера на карте
function updateMapMarker(lat, lon) {
  if (!window.marker) return;
  window.marker.setLatLng([+lat, +lon]);
  window.mapInstance.panTo([+lat, +lon]);
}