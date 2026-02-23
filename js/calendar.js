// Render calendar grid (no weekday headers — those are in HTML)
export function renderCalendar(container, year, month, routines, completions, onToggle) {
  container.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    container.appendChild(empty);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month, day).getDay();
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (dateStr === todayStr) cell.classList.add('today');

    const num = document.createElement('span');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    // Only show non-allday routines in calendar cells, sorted by time of day
    const timeOrder = { morning: 0, evening: 1, night: 2 };
    const dayRoutines = routines.filter(r => {
      const days = r.days || [];
      const tod = r.timeOfDay || 'allday';
      return days.includes(dayOfWeek) && tod !== 'allday';
    }).sort((a, b) =>
      (timeOrder[a.timeOfDay] ?? 1) - (timeOrder[b.timeOfDay] ?? 1)
    );

    if (dayRoutines.length > 0) {
      const checksWrap = document.createElement('div');
      checksWrap.className = 'day-checks';

      dayRoutines.forEach(r => {
        const done = completions[dateStr] && completions[dateStr][r.id];
        const check = document.createElement('button');
        check.className = 'day-check' + (done ? ' done' : '');
        check.style.setProperty('--check-color', r.color);
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

  // Trailing empty cells
  const totalCells = firstDay + daysInMonth;
  const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < trailing; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    container.appendChild(empty);
  }
}

export function renderLegend(container, routines) {
  container.innerHTML = '';
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  routines.forEach(r => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = r.color;

    const label = document.createElement('span');
    label.className = 'legend-label';
    const dayCount = (r.days || []).length;
    const dayNames = (r.days || []).map(d => DAY_LABELS[d]).join(', ');
    label.textContent = `${r.icon} ${r.name}`;
    label.title = `${dayCount}x/wk: ${dayNames}`;

    item.appendChild(dot);
    item.appendChild(label);
    container.appendChild(item);
  });
}

export function getMonthLabel(year, month) {
  const date = new Date(year, month);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Render "All Day" routines as a table below the calendar
export function renderAlldayTable(container, year, month, routines, completions, onToggle) {
  container.innerHTML = '';
  const alldayRoutines = routines.filter(r => (r.timeOfDay || 'allday') === 'allday');
  if (alldayRoutines.length === 0) return;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const section = document.createElement('div');
  section.className = 'allday-section';

  const header = document.createElement('div');
  header.className = 'allday-header';
  header.textContent = 'Daily Routines';
  section.appendChild(header);

  alldayRoutines.forEach(r => {
    const row = document.createElement('div');
    row.className = 'allday-row';

    const done = isCurrentMonth && completions[todayStr] && completions[todayStr][r.id];

    row.innerHTML = `
      <div class="allday-icon" style="background:${r.color}22; color:${r.color}">${r.icon}</div>
      <div class="allday-info">
        <div class="allday-name">${escapeHtml(r.name)}</div>
        <div class="allday-desc">${r.description || ''}</div>
      </div>
    `;

    if (isCurrentMonth) {
      const checkBtn = document.createElement('button');
      checkBtn.className = 'allday-check' + (done ? ' done' : '');
      checkBtn.style.setProperty('--check-color', r.color);
      checkBtn.innerHTML = done ? '&#10003;' : '';
      checkBtn.title = done ? 'Completed today' : 'Mark as done today';
      checkBtn.addEventListener('click', () => onToggle(todayStr, r.id));
      row.appendChild(checkBtn);
    }

    section.appendChild(row);
  });

  container.appendChild(section);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Compute weekly progress for quest path
export function computeWeeklyProgress(year, month, routines, completions) {
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let weekStart = 1;

  // First partial week
  if (firstDayOfWeek > 0) {
    const firstWeekEnd = Math.min(7 - firstDayOfWeek, totalDays);
    const w = countWeekCompletions(year, month, weekStart, firstWeekEnd, routines, completions);
    weeks.push({ weekNum: 1, ...w });
    weekStart = firstWeekEnd + 1;
  }

  while (weekStart <= totalDays) {
    const weekEnd = Math.min(weekStart + 6, totalDays);
    const w = countWeekCompletions(year, month, weekStart, weekEnd, routines, completions);
    weeks.push({ weekNum: weeks.length + 1, ...w });
    weekStart = weekEnd + 1;
  }

  return weeks;
}

function countWeekCompletions(year, month, start, end, routines, completions) {
  let expected = 0;
  let completed = 0;

  for (let d = start; d <= end; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month, d).getDay();

    routines.forEach(r => {
      const days = r.days || [];
      if (days.includes(dayOfWeek)) {
        expected++;
        if (completions[dateStr] && completions[dateStr][r.id]) {
          completed++;
        }
      }
    });
  }

  return { completed, expected };
}
