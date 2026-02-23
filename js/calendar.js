const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function renderCalendar(container, year, month, routines, completions, onToggle) {
  container.innerHTML = '';

  // Header row
  DAY_NAMES.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-header';
    el.textContent = d;
    container.appendChild(el);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell empty';
    container.appendChild(el);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (dateStr === todayStr) cell.classList.add('today');

    const dayNum = document.createElement('span');
    dayNum.className = 'cal-day-num';
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    // Routine checkmarks for this day
    if (routines.length > 0) {
      const checksWrap = document.createElement('div');
      checksWrap.className = 'cal-checks';

      routines.forEach(r => {
        const done = completions[dateStr] && completions[dateStr][r.id];
        const check = document.createElement('button');
        check.className = 'cal-check' + (done ? ' done' : '');
        check.style.borderColor = r.color;
        if (done) check.style.backgroundColor = r.color;
        check.title = r.name;
        check.innerHTML = done ? '&#10003;' : r.icon;
        check.addEventListener('click', (e) => {
          e.stopPropagation();
          onToggle(dateStr, r.id);
        });
        checksWrap.appendChild(check);
      });

      cell.appendChild(checksWrap);
    }

    container.appendChild(cell);
  }
}

export function renderLegend(container, routines) {
  container.innerHTML = '';
  routines.forEach(r => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.backgroundColor = r.color;
    dot.textContent = r.icon;

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = `${r.name} (${r.timesPerWeek}x/wk)`;

    item.appendChild(dot);
    item.appendChild(label);
    container.appendChild(item);
  });
}

export function getMonthLabel(year, month) {
  const date = new Date(year, month);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}
