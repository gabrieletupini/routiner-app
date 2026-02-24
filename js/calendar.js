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

    // Routines scheduled for all 7 days go to the table below; others show in calendar
    const timeOrder = { morning: 0, allday: 1, evening: 2, night: 3 };
    const dayRoutines = routines.filter(r => {
      const days = r.days || [];
      return days.includes(dayOfWeek) && days.length < 7;
    }).sort((a, b) =>
      (timeOrder[a.timeOfDay || 'allday'] ?? 1) - (timeOrder[b.timeOfDay || 'allday'] ?? 1)
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

// Render everyday (7-day) routines as a table below the calendar
export function renderAlldayTable(container, year, month, routines, completions, onToggle) {
  container.innerHTML = '';
  const alldayRoutines = routines.filter(r => (r.days || []).length === 7);
  if (alldayRoutines.length === 0) return;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Compute current week dates (Sun–Sat containing today)
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDates = [];
  if (isCurrentMonth) {
    const sun = new Date(today);
    sun.setDate(today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      weekDates.push({ d, dateStr, label: DAY_LABELS[i] });
    }
  }

  const section = document.createElement('div');
  section.className = 'allday-section';

  // Header: title on left, day labels on right
  const headerRow = document.createElement('div');
  headerRow.className = 'allday-header-row';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'allday-header-title';
  headerTitle.textContent = 'Daily Routines';
  headerRow.appendChild(headerTitle);

  if (isCurrentMonth) {
    const weekLabels = document.createElement('div');
    weekLabels.className = 'allday-week-labels';
    weekDates.forEach(({ d, label }) => {
      const lbl = document.createElement('div');
      lbl.className = 'allday-day-label' + (d.toDateString() === today.toDateString() ? ' today' : '');
      lbl.innerHTML = `<span class="allday-day-name">${label}</span><span class="allday-day-num">${d.getDate()}</span>`;
      weekLabels.appendChild(lbl);
    });
    headerRow.appendChild(weekLabels);
  }
  section.appendChild(headerRow);

  // Routine rows
  alldayRoutines.forEach(r => {
    const row = document.createElement('div');
    row.className = 'allday-row';

    // Left: icon + name + optional info button
    const left = document.createElement('div');
    left.className = 'allday-left';

    const icon = document.createElement('div');
    icon.className = 'allday-icon';
    icon.style.background = `${r.color}22`;
    icon.textContent = r.icon;
    left.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'allday-name';
    name.textContent = r.name;
    left.appendChild(name);

    if (r.description) {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'allday-info-btn';
      infoBtn.title = 'View description';
      infoBtn.textContent = 'i';
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDescPopover(infoBtn, r);
      });
      left.appendChild(infoBtn);
    }

    row.appendChild(left);

    // Right: 7-day week checkmarks
    if (isCurrentMonth) {
      const weekChecks = document.createElement('div');
      weekChecks.className = 'allday-week-checks';
      weekDates.forEach(({ d, dateStr }) => {
        const done = completions[dateStr] && completions[dateStr][r.id];
        const btn = document.createElement('button');
        btn.className = 'allday-check' + (done ? ' done' : '') + (d.toDateString() === today.toDateString() ? ' is-today' : '');
        btn.style.setProperty('--check-color', r.color);
        btn.innerHTML = done ? '&#10003;' : '';
        btn.addEventListener('click', () => onToggle(dateStr, r.id));
        weekChecks.appendChild(btn);
      });
      row.appendChild(weekChecks);
    }

    section.appendChild(row);
  });

  container.appendChild(section);
}

function showDescPopover(anchor, routine) {
  document.querySelector('.allday-popover')?.remove();

  const popover = document.createElement('div');
  popover.className = 'allday-popover';
  popover.innerHTML = `
    <div class="allday-popover-header">
      <span>${routine.icon} ${escapeHtml(routine.name)}</span>
      <button class="allday-popover-close">&times;</button>
    </div>
    <div class="allday-popover-body">${routine.description}</div>
  `;
  document.body.appendChild(popover);

  // Position below the anchor button
  const rect = anchor.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 6;
  const left = Math.min(
    Math.max(8, rect.left + window.scrollX - 120),
    window.innerWidth - popover.offsetWidth - 8
  );
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;

  popover.querySelector('.allday-popover-close').addEventListener('click', () => popover.remove());
  setTimeout(() => {
    document.addEventListener('click', function handler() {
      popover.remove();
      document.removeEventListener('click', handler);
    });
  }, 0);
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
