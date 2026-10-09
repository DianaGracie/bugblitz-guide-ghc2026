(function () {
  function setupLaunchWidget() {
    const input = document.getElementById('table-input');
    const errorEl = document.getElementById('table-input-error');
    const trigger = document.querySelector('[data-launch-stackblitz]');

    if (!input || !errorEl) return;

    function clearTableError() {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
      input.removeAttribute('aria-invalid');
      input.style.borderColor = 'var(--border-color, #ccc)';
    }

    function launchStackBlitz() {
      const teamId = Number(input.value);

      if (!Number.isInteger(teamId) || teamId < 1 || teamId > 50) {
        errorEl.textContent = 'Please enter a valid table number between 1 and 50.';
        errorEl.style.display = 'block';
        input.setAttribute('aria-invalid', 'true');
        input.style.borderColor = '#dc2626';
        return;
      }

      clearTableError();

      const repoUrl = 'https://stackblitz.com/edit/bugblitz-ghc2026';
      const targetUrl = `${repoUrl}?file=README.md&initialpath=/?team=${teamId}`;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }

    input.addEventListener('input', clearTableError);
    if (trigger) trigger.addEventListener('click', launchStackBlitz);

    window.launchStackBlitz = launchStackBlitz;
    window.clearTableError = clearTableError;
  }

  function setupBugGuides() {
    const filters = document.querySelectorAll('.bug-guide-filter');
    const bugCardsContainer = document.getElementById('bug-guide-cards');
    if (!bugCardsContainer) return;
    const cards = bugCardsContainer.querySelectorAll('.bug-guide-card');
    const empty = document.getElementById('bug-guide-empty');

    if (!cards.length) return;

    const state = { type: 'all', reporter: 'all' };
    const storageKey = 'bugblitz-guide-triage-v1';
    const assignments = Object.create(null);
    const options = { priority: ['', 'P1', 'P2', 'P3'], effort: ['', 'Low', 'Medium', 'High'] };
    const toc = document.querySelector('.triage-table tbody');
    const priorityLabels = { P1: 'P1 (High)', P2: 'P2 (Medium)', P3: 'P3 (Low)' };
    const initialEffort = {
      'welcome-offer-mobile': 'Low',
      'duplicate-order-placed': 'High',
      'generic-error': 'Medium',
      'international-postal-code': 'High',
      'stale-state': 'Medium',
      'sold-out-feedback': 'Low',
      'broken-image': 'Low',
      'dialog-bug': 'Medium',
      'promo-duplicate': 'Medium',
      'sale-price-not-honored': 'Medium',
      'stale-search': 'High'
    };
    const pending = document.getElementById('needs-triage-tiles');
    const pendingHelp = document.getElementById('needs-triage-help');
    const zones = Array.from(document.querySelectorAll('.triage-board td'));
    // Dropping a bug back on Needs triage clears its priority but keeps its effort.
    const needsTriage = document.getElementById('needs-triage');
    const dropZones = needsTriage ? [...zones, needsTriage] : zones;

    if (typeof ResizeObserver !== 'undefined' && zones.length) {
      const tileWidthObserver = new ResizeObserver(([measurement]) => {
        if (measurement.contentRect.width > 0) {
          pending.style.setProperty('--matrix-tile-width', measurement.contentRect.width + 'px');
        }
      });
      tileWidthObserver.observe(zones[0].querySelector('.board-tiles'));
    }

    const count = document.getElementById('triage-count');
    const entries = [];
    let draggedEntry = null;
    // Re-applies the Bug Directory filters; set once the filter toolbar is wired up.
    let refreshDirectory = () => {};

    function finishDrag() {
      if (draggedEntry) {
        draggedEntry.tile.classList.remove('dragging');
        draggedEntry.tile.classList.remove('drag-source');
      }
      draggedEntry = null;
      dropZones.forEach((zone) => zone.classList.remove('drop-target'));
    }

    function summary(value) {
      return (priorityLabels[value.priority] || 'Priority unassigned') + ' · ' + (value.effort ? value.effort + ' effort' : 'Effort unassigned');
    }

    function saveAssignment() {
      render();
      refreshDirectory();

      try {
        localStorage.setItem(storageKey, JSON.stringify(assignments));
      } catch (_) {
        // Storage unavailable; assignments last for this visit only.
      }
    }

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch (_) {
      saved = {};
    }

    function render() {
      let assigned = 0;
      entries.forEach((entry) => {
        const value = assignments[entry.card.id];
        entry.priorityBadge.textContent = priorityLabels[value.priority] || 'Priority unassigned';
        entry.priorityBadge.dataset.priority = value.priority;
        entry.priorityBadge.className = value.priority ? 'priority-badge' : '';
        if (entry.indexBadge) {
          entry.indexBadge.textContent = value.priority || '—';
          entry.indexBadge.dataset.priority = value.priority;
          entry.indexBadge.classList.toggle('priority-badge', Boolean(value.priority));
          entry.indexBadge.title = priorityLabels[value.priority] || 'Priority unassigned';
        }
        entry.effortText.textContent = value.effort ? value.effort + ' effort' : ' · Effort unassigned';
        entry.effortText.className = value.effort ? 'effort-badge' : '';

        Object.keys(entry.controls).forEach((field) => {
          entry.controls[field].value = value[field];
        });

        entry.badge.setAttribute('aria-label', entry.title + ': ' + summary(value) + '. Edit in the Bug List');

        const zone = zones.find((zone) => zone.dataset.priority === value.priority && zone.dataset.effort === value.effort);
        if (zone) {
          zone.querySelector('.board-tiles').append(entry.tile);
          assigned++;
        } else if (pending) {
          pending.append(entry.tile);
        }

        if (entry.missing) {
          entry.missing.hidden = Boolean(zone);
          entry.missing.textContent = !value.priority && !value.effort
            ? 'Priority and effort needed'
            : !value.priority
              ? 'Priority needed · ' + value.effort + ' effort'
              : 'Effort needed';
        }
      });

      if (count) {
        count.textContent = assigned + ' of ' + entries.length + ' bugs assigned to the matrix.';
      }

      if (pendingHelp) {
        pendingHelp.textContent = assigned === entries.length
          ? 'All bugs have a priority and effort assignment.'
          : 'Set missing values in the Bug Directory above to place these bugs in the matrix.';
      }
    }

    cards.forEach((card) => {
      // The bug report card's heading is the source of truth for the bug's name.
      const title = card.querySelector('h3').textContent.replace(/\s+/g, ' ').trim();
      const row = toc ? toc.querySelector('a[href="#' + card.id + '"]')?.closest('tr') : null;
      assignments[card.id] = {};

      const tile = document.createElement('div');
      tile.className = 'board-tile';

      const link = document.createElement('a');
      link.href = '#' + card.id;
      link.textContent = title;
      link.draggable = false;

      const handle = document.createElement('span');
      handle.className = 'board-drag-handle';
      handle.textContent = '⠿';
      handle.draggable = true;
      handle.title = 'Drag to change priority and effort; alternatively use the Bug List';
      handle.setAttribute('aria-hidden', 'true');
      tile.append(handle);

      const content = document.createElement('div');
      content.className = 'board-tile-content';
      const missing = document.createElement('span');
      missing.className = 'triage-missing';
      content.append(link);
      content.append(missing);
      tile.append(content);

      const badge = document.createElement('a');
      badge.className = 'triage-summary';
      badge.href = '#assignment-' + card.id;
      const indexBadge = document.querySelector('.toc-link[href="#' + card.id + '"] .toc-bug-id');
      const priorityBadge = document.createElement('span');
      const effortText = document.createElement('span');
      badge.append(priorityBadge);
      badge.append(effortText);

      const reporterLine = card.querySelector('.reporter-line');
      if (reporterLine) reporterLine.after(badge);

      const entry = { card, title, tile, badge, priorityBadge, effortText, missing, indexBadge, controls: {} };
      entries.push(entry);

      handle.addEventListener('dragstart', (event) => {
        if (window.matchMedia('(max-width: 700px), (pointer: coarse)').matches) {
          event.preventDefault();
          return;
        }
        draggedEntry = entry;
        event.dataTransfer.setData('text/plain', card.id);
        event.dataTransfer.effectAllowed = 'move';
        tile.classList.add('dragging');
        const bounds = tile.getBoundingClientRect();
        event.dataTransfer.setDragImage(tile, event.clientX - bounds.left, event.clientY - bounds.top);

        requestAnimationFrame(() => {
          if (draggedEntry === entry) tile.classList.add('drag-source');
        });
      });

      handle.addEventListener('dragend', finishDrag);

      Object.keys(options).forEach((field) => {
        const value = saved[card.id] && saved[card.id][field];
        assignments[card.id][field] = options[field].includes(value) ? value : (field === 'effort' ? initialEffort[card.id] || 'Medium' : '');
        const fieldName = field === 'priority' ? 'Priority' : 'Effort';
        const select = document.createElement('select');
        select.className = 'triage-value';
        select.setAttribute('aria-label', fieldName + ' for ' + title);

        options[field].forEach((choice) => {
          const option = document.createElement('option');
          option.value = choice;
          option.textContent = choice ? (field === 'priority' ? priorityLabels[choice] : choice) : 'Set ' + field;
          select.append(option);
        });

        entry.controls[field] = select;
        select.addEventListener('change', () => {
          assignments[card.id][field] = select.value;
          saveAssignment();
        });

        if (row) {
          const fieldCell = row.querySelector('[data-label="' + fieldName + '"]');
          if (fieldCell) fieldCell.append(select);
        }
      });
    });

    dropZones.forEach((zone) => {
      zone.addEventListener('dragover', (event) => {
        if (!draggedEntry) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        zone.classList.add('drop-target');
      });

      zone.addEventListener('dragleave', (event) => {
        if (!zone.contains(event.relatedTarget)) zone.classList.remove('drop-target');
      });

      zone.addEventListener('drop', (event) => {
        if (!draggedEntry) return;
        event.preventDefault();
        const entry = draggedEntry;
        assignments[entry.card.id] = zone === needsTriage
          ? { priority: '', effort: assignments[entry.card.id].effort }
          : { priority: zone.dataset.priority, effort: zone.dataset.effort };
        finishDrag();
        saveAssignment();
      });
    });

    render();

    function apply() {
      let visible = 0;
      cards.forEach((card) => {
        const types = (card.dataset.types || '').split(/\s+/);
        const reporter = card.dataset.reporter || '';
        const typeMatch = state.type === 'all' || types.includes(state.type);
        const repMatch = state.reporter === 'all' || reporter === state.reporter;
        const show = typeMatch && repMatch;
        card.classList.toggle('hidden', !show);
        if (show) visible++;
      });

      if (empty) {
        empty.classList.toggle('show', visible === 0);
      }
    }

    filters.forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        state[group] = btn.dataset.filter;
        filters.forEach((b) => {
          if (b.dataset.group === group) b.classList.toggle('active', b === btn);
        });
        apply();
      });
    });

    const toolbar = document.getElementById('bug-filter-toolbar');
    if (!toolbar) return;

    const filterPills = toolbar.querySelectorAll('.bug-guide-filter');
    const typeSelect = document.getElementById('filter-type');
    const reporterSelect = document.getElementById('filter-reporter');
    const clearBtn = document.getElementById('clear-filters-btn');
    const emptyStateEl = document.getElementById('bug-guide-empty');
    const bugCards = document.querySelectorAll('.bug-guide-card');
    const visibleCountEl = document.getElementById('visible-count');
    const totalCountEl = document.getElementById('total-count');

    let activePreset = 'all';
    const validPresets = Array.from(filterPills, (pill) => pill.dataset.filter);
    const initialUrl = new URL(window.location.href);
    const initialFilter = initialUrl.searchParams.get('filter');
    const initialPriority = initialUrl.searchParams.get('priority');
    if (validPresets.includes(initialFilter)) activePreset = initialFilter;
    else if (['P1', 'P2', 'P3'].includes(initialPriority)) activePreset = initialPriority;

    if (typeSelect && Array.from(typeSelect.options, (option) => option.value).includes(initialUrl.searchParams.get('type'))) {
      typeSelect.value = initialUrl.searchParams.get('type');
    }
    if (reporterSelect && Array.from(reporterSelect.options, (option) => option.value).includes(initialUrl.searchParams.get('reporter'))) {
      reporterSelect.value = initialUrl.searchParams.get('reporter');
    }
    filterPills.forEach((pill) => pill.classList.toggle('active', pill.dataset.filter === activePreset));

    if (totalCountEl) totalCountEl.textContent = bugCards.length;

    function getBugData(card) {
      const bugId = card.id;

      let type = (card.getAttribute('data-type') || '').toLowerCase();
      if (!type) {
        const typeEl = card.querySelector('.bug-guide-card-type');
        if (typeEl) {
          const classMatch = typeEl.className.match(/cat-([a-z]+)/);
          type = classMatch ? classMatch[1] : typeEl.textContent.trim().toLowerCase();
        }
      }

      let reporter = (card.getAttribute('data-reporter') || '').toLowerCase();
      if (!reporter) {
        const reporterEl = card.querySelector('.reporter-line strong');
        if (reporterEl) reporter = reporterEl.textContent.trim().toLowerCase();
      }

      const tocRow = document.querySelector(`.triage-table tr[data-for="${bugId}"]`) || document.querySelector(`.triage-table tr[id="assignment-${bugId}"]`);

      let priority = (card.getAttribute('data-priority') || '').trim().toUpperCase();
      let effort = (card.getAttribute('data-effort') || '').trim().toLowerCase();

      if (tocRow) {
        const selects = tocRow.querySelectorAll('.triage-value, select');
        if (selects.length >= 2) {
          const pVal = selects[0].value.trim();
          const eVal = selects[1].value.trim();
          if (pVal) priority = pVal.toUpperCase();
          if (eVal) effort = eVal.toLowerCase();
        }
      }

      const isTriaged = Boolean(priority && priority !== 'SELECT' && effort && effort !== 'SELECT');
      const isQuickWin = (priority === 'P1' && (effort === 'low' || effort === 'l' || effort === 'quick'));

      return { type, reporter, priority, effort, isTriaged, isQuickWin };
    }

    let temporarilyRevealedBugId = null;
    const matchesDivider = document.createElement('h3');
    matchesDivider.className = 'filter-match-divider';
    matchesDivider.textContent = 'Matches your filters';
    const sidebarBugLinks = Array.from(document.querySelectorAll('.toc-link[href^="#"]'));

    // Highlight the bug that is open in the Bug Directory's report viewer.
    function updateActiveBugLink() {
      const openId = document.querySelector('.triage-table tr.is-selected')?.id.replace('assignment-', '');
      sidebarBugLinks.forEach((link) => {
        if (openId && link.getAttribute('href') === '#' + openId) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    document.addEventListener('reportviewerchange', updateActiveBugLink);

    function syncFiltersToUrl() {
      const url = new URL(window.location.href);
      if (['P1', 'P2', 'P3'].includes(activePreset)) url.searchParams.set('priority', activePreset);
      else url.searchParams.delete('priority');
      if (['needs-triage', 'quick-wins'].includes(activePreset)) url.searchParams.set('filter', activePreset);
      else url.searchParams.delete('filter');
      if (typeSelect?.value && typeSelect.value !== 'all') url.searchParams.set('type', typeSelect.value);
      else url.searchParams.delete('type');
      if (reporterSelect?.value && reporterSelect.value !== 'all') url.searchParams.set('reporter', reporterSelect.value);
      else url.searchParams.delete('reporter');
      window.history.replaceState(window.history.state, '', url);
    }

    function revealNoticeTextColor(card) {
      const channels = getComputedStyle(card).borderTopColor.match(/\d+(?:\.\d+)?/g);
      if (!channels || channels.length < 3) return '#fff';

      const [red, green, blue] = channels.slice(0, 3).map((channel) => {
        const value = Number(channel) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      return luminance > 0.179 ? '#111' : '#fff';
    }

    function clearTemporaryReveal() {
      if (!temporarilyRevealedBugId) return;
      document.getElementById(temporarilyRevealedBugId)?.querySelector('.filter-reveal-notice')?.remove();
      temporarilyRevealedBugId = null;
      matchesDivider.remove();
      cards.forEach((card) => bugCardsContainer.append(card));
    }

    refreshDirectory = () => applyFilters();

    function applyFilters() {
      let visibleCount = 0;
      let matchingCount = 0;
      const selectedType = typeSelect ? typeSelect.value : 'all';
      const selectedReporter = reporterSelect ? reporterSelect.value : 'all';

      if (typeSelect) typeSelect.classList.toggle('active', selectedType !== 'all');
      if (reporterSelect) reporterSelect.classList.toggle('active', selectedReporter !== 'all');

      const isFiltered = (activePreset !== 'all') || (selectedType !== 'all') || (selectedReporter !== 'all');
      if (clearBtn) clearBtn.hidden = !isFiltered;

      bugCards.forEach((card) => {
        const bugId = card.id;
        const data = getBugData(card);
        const tocRow = document.querySelector(`.triage-table tr[data-for="${bugId}"]`) || document.querySelector(`.triage-table tr[id="assignment-${bugId}"]`);

        let matchesPreset = true;
        if (activePreset === 'needs-triage') matchesPreset = !data.isTriaged;
        else if (activePreset === 'quick-wins') matchesPreset = data.isQuickWin;
        else if (['P1', 'P2', 'P3'].includes(activePreset)) matchesPreset = (data.priority === activePreset);

        const matchesType = (selectedType === 'all') || (data.type === selectedType) || data.type.includes(selectedType);
        const matchesReporter = (selectedReporter === 'all') || (data.reporter === selectedReporter) || data.reporter.includes(selectedReporter);
        const isMatch = matchesPreset && matchesType && matchesReporter;
        if (temporarilyRevealedBugId === bugId && isMatch) clearTemporaryReveal();
        const isTemporarilyRevealed = temporarilyRevealedBugId === bugId && !isMatch;
        const isVisible = isMatch || isTemporarilyRevealed;
        const sidebarLink = document.querySelector('.toc-link[href="#' + bugId + '"]');
        if (sidebarLink) sidebarLink.hidden = !isVisible;

        let revealNotice = card.querySelector('.filter-reveal-notice');
        if (isTemporarilyRevealed && !revealNotice) {
          revealNotice = document.createElement('div');
          revealNotice.className = 'filter-reveal-notice';
          revealNotice.setAttribute('role', 'status');
          revealNotice.textContent = '**Normally hidden by active filters**';
          revealNotice.style.color = revealNoticeTextColor(card);
          card.querySelector('.bug-guide-card-header')?.before(revealNotice);
        } else if (!isTemporarilyRevealed) {
          revealNotice?.remove();
        }

        card.classList.toggle('hidden', !isVisible);
        if (isMatch) matchingCount++;
        if (isVisible) visibleCount++;
        if (tocRow) tocRow.classList.toggle('filtered-out', !isVisible);
      });

      if (temporarilyRevealedBugId) {
        const revealedCard = document.getElementById(temporarilyRevealedBugId);
        if (revealedCard) {
          bugCardsContainer.prepend(revealedCard);
          if (matchingCount) revealedCard.after(matchesDivider);
          else matchesDivider.remove();
        }
      }

      if (visibleCountEl) visibleCountEl.textContent = visibleCount;
      const sidebarCount = document.getElementById('sidebar-result-count');
      if (sidebarCount) sidebarCount.textContent = visibleCount + ' of ' + bugCards.length + ' bugs';
      const sidebarClear = document.getElementById('sidebar-clear-filters');
      if (sidebarClear) sidebarClear.hidden = !isFiltered;
      const sidebarEmpty = document.getElementById('sidebar-empty');
      if (sidebarEmpty) sidebarEmpty.hidden = visibleCount !== 0;

      if (emptyStateEl) {
        emptyStateEl.classList.toggle('show', visibleCount === 0);
      }
      syncFiltersToUrl();
      updateActiveBugLink();
    }

    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        clearTemporaryReveal();
        filterPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');

        activePreset = pill.getAttribute('data-filter');
        applyFilters();
      });
    });

    if (typeSelect) typeSelect.addEventListener('change', () => {
      clearTemporaryReveal();
      applyFilters();
    });
    if (reporterSelect) reporterSelect.addEventListener('change', () => {
      clearTemporaryReveal();
      applyFilters();
    });

    function resetFilters() {
      clearTemporaryReveal();
      filterPills.forEach((pill) => pill.classList.remove('active'));
      toolbar.querySelector('[data-filter="all"]')?.classList.add('active');
      activePreset = 'all';
      if (typeSelect) typeSelect.value = 'all';
      if (reporterSelect) reporterSelect.value = 'all';
      applyFilters();
    }
    clearBtn?.addEventListener('click', resetFilters);
    document.getElementById('sidebar-clear-filters')?.addEventListener('click', () => {
      resetFilters();
      document.querySelector('.toc-link:not([hidden])')?.focus();
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const card = document.getElementById(link.getAttribute('href').slice(1));
      if (!card?.classList.contains('bug-guide-card') || card.id === temporarilyRevealedBugId) return;
      const wasHidden = card.classList.contains('hidden');
      if (!wasHidden && !temporarilyRevealedBugId) return;
      clearTemporaryReveal();
      if (wasHidden) temporarilyRevealedBugId = card.id;
      applyFilters();
    });

    window.addEventListener('hashchange', () => {
      if (!temporarilyRevealedBugId || window.location.hash.slice(1) === temporarilyRevealedBugId) return;
      clearTemporaryReveal();
      applyFilters();
    });

    document.addEventListener('change', (event) => {
      if (event.target.classList.contains('triage-value') || event.target.closest('.triage-table')) {
        applyFilters();
      }
    });

    applyFilters();
    const initialHashTarget = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (initialHashTarget?.classList.contains('bug-guide-card') && initialHashTarget.classList.contains('hidden')) {
      temporarilyRevealedBugId = initialHashTarget.id;
      applyFilters();
    }
  }

  // Collapse each item to its header (everything through `headerEnd`), with an
  // Expand/Collapse all button before the first item. Without JavaScript every
  // item stays fully expanded.
  function setupCollapsibles(items, { headerEnd, startExpanded }) {
    items = items.filter((item) => item.id && item.querySelector('h2'));
    if (!items.length) return;

    const toggles = new Map();
    const toggleAllButton = document.createElement('button');
    toggleAllButton.type = 'button';
    toggleAllButton.className = 'collapse-all';

    const isExpanded = (item) => !item.classList.contains('collapsed');

    const syncToggleAll = () => {
      const allExpanded = items.every(isExpanded);
      toggleAllButton.textContent = allExpanded ? 'Collapse all' : 'Expand all';
      toggleAllButton.setAttribute('aria-pressed', String(allExpanded));
    };

    const setExpanded = (item, expanded) => {
      const { button, body } = toggles.get(item);
      item.classList.toggle('collapsed', !expanded);
      button.setAttribute('aria-expanded', String(expanded));
      // until-found keeps collapsed text reachable by the browser's find-in-page.
      if (expanded) body.removeAttribute('hidden');
      else body.setAttribute('hidden', 'until-found');
      syncToggleAll();
    };

    items.forEach((item) => {
      const heading = item.querySelector('h2');
      const lastHeaderNode = headerEnd(item) || heading;

      const body = document.createElement('div');
      body.className = 'collapse-body';
      body.id = item.id + '-body';
      while (lastHeaderNode.nextSibling) body.appendChild(lastHeaderNode.nextSibling);
      item.appendChild(body);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'collapse-toggle';
      button.setAttribute('aria-controls', body.id);
      while (heading.firstChild) button.appendChild(heading.firstChild);
      heading.appendChild(button);

      toggles.set(item, { button, body });
      button.addEventListener('click', () => setExpanded(item, !isExpanded(item)));
      body.addEventListener('beforematch', () => setExpanded(item, true));
      setExpanded(item, startExpanded);
    });

    toggleAllButton.addEventListener('click', () => {
      const expand = !items.every(isExpanded);
      items.forEach((item) => setExpanded(item, expand));
    });
    const controls = document.createElement('div');
    controls.className = 'collapse-controls';
    controls.appendChild(toggleAllButton);
    items[0].before(controls);
    syncToggleAll();

    // Open the item a link points at, including links from other pages.
    const reveal = (hash) => {
      const id = decodeURIComponent(hash.slice(1));
      const item = id && items.find((candidate) => candidate.contains(document.getElementById(id)));
      if (item) setExpanded(item, true);
    };
    reveal(window.location.hash);
    window.addEventListener('hashchange', () => reveal(window.location.hash));
    // Expand during the click, before the browser scrolls; expanding on
    // hashchange is too late and the scroll falls short of the item.
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (link) reveal(link.getAttribute('href'));
    }, true);
  }

  function setupCollapsibleSections() {
    const page = document.documentElement.dataset.page;
    if (page === 'recap') {
      setupCollapsibles(Array.from(document.querySelectorAll('.content > section')), {
        headerEnd: (section) => section.querySelector(':scope > h2'),
        startExpanded: true,
      });
    }
  }

  // Native disclosures remain usable without JavaScript. With JavaScript,
  // reveal the next control only after the preceding hint has been opened.
  function setupHints(root) {
    root.querySelectorAll('.bug-hints').forEach((group) => {
      const hints = Array.from(group.querySelectorAll('.bug-hint'));
      hints.forEach((hint, index) => {
        hint.hidden = index > 0 && !hints[index - 1].open;
        hint.addEventListener('toggle', () => {
          if (hint.open && hints[index + 1]) hints[index + 1].hidden = false;
        });
      });
    });
  }

  // List + viewer: show the selected item's full content beside the list (or,
  // in the single-column layout, right under the item), so readers never have
  // to scroll to the bottom of the page. The full content blocks are hidden and
  // serve as the source, and every link to one (#id) opens it here. Clicking
  // the selected item again closes it and the list returns to full width.
  // Without JavaScript the content blocks stay visible and links jump to them.
  function setupListViewer({ layout, list, items, viewer, sources, closeLabel, tip, openFirst = true }) {
    if (!layout || !list || !viewer || !sources || !items.length) return;

    // Optional tip bubble pointing at the titles. It appears only on a
    // reader's first visit and stays until they close it.
    if (tip) {
      const tipKey = 'bugblitz-viewer-tip-seen-' + viewer.id;
      let tipSeen = false;
      try {
        tipSeen = localStorage.getItem(tipKey) === '1';
        localStorage.setItem(tipKey, '1');
      } catch (_) { /* storage unavailable: show the tip every visit */ }
      if (!tipSeen) {
        const tipBubble = document.createElement('p');
        tipBubble.className = 'viewer-tip';
        const tipText = document.createElement('span');
        tipText.textContent = tip;
        const tipClose = document.createElement('button');
        tipClose.type = 'button';
        tipClose.className = 'viewer-tip-close';
        tipClose.setAttribute('aria-label', 'Dismiss tip');
        tipClose.textContent = '×';
        tipClose.addEventListener('click', () => tipBubble.remove());
        tipBubble.append(tipText, tipClose);
        // Sit just above the first title, pointing at it.
        const firstLink = items[0].querySelector('a[href^="#"]');
        firstLink.parentElement.classList.add('has-viewer-tip');
        firstLink.before(tipBubble);
        // Point at the end of the first title rather than its start.
        const alignTip = () => tipBubble.style.setProperty('--tip-offset', Math.max(0, firstLink.offsetWidth - 30) + 'px');
        alignTip();
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(alignTip).observe(firstLink);
      }
    }

    const linkFor = (item) => item.querySelector('a[href^="#"]');
    const idFor = (item) => linkFor(item)?.getAttribute('href').slice(1);
    const itemFor = (id) => items.find((item) => idFor(item) === id);
    const singleColumn = window.matchMedia('(max-width: 900px)');
    let selectedItem = null;

    // Single-column layout: the viewer gets its own row (a table row, or an
    // unnumbered list item) right after the selected item.
    let inlineSlot;
    if (items[0].tagName === 'TR') {
      inlineSlot = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = items[0].children.length;
      inlineSlot.append(cell);
    } else {
      inlineSlot = document.createElement('li');
      inlineSlot.setAttribute('role', 'presentation');
    }
    inlineSlot.className = 'report-viewer-row';
    const inlineTarget = inlineSlot.firstElementChild || inlineSlot;

    // Long content: close from the bottom without scrolling back to the title.
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'report-viewer-close';
    closeButton.textContent = closeLabel;
    closeButton.addEventListener('click', () => {
      const item = selectedItem;
      select(null);
      item?.scrollIntoView({ block: 'nearest' });
      linkFor(item)?.focus({ preventScroll: true });
    });

    const copyOf = (source) => {
      const copy = source.cloneNode(true);
      // Copies must not duplicate ids, collapse wiring, or the live priority
      // badge; the Bug Directory row already shows priority and effort.
      copy.removeAttribute('id');
      copy.classList.remove('collapsed', 'hidden');
      copy.classList.add('report-viewer-card');
      copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      copy.querySelectorAll('.triage-summary, .filter-reveal-notice').forEach((el) => el.remove());
      copy.querySelectorAll('details').forEach((details) => { details.open = false; });
      setupHints(copy);
      return copy;
    };

    // Beside the list in two columns; under the selected item in one column.
    const placeViewer = () => {
      if (singleColumn.matches && selectedItem) {
        inlineTarget.append(viewer);
        selectedItem.after(inlineSlot);
      } else {
        inlineSlot.remove();
        layout.append(viewer);
      }
      viewer.hidden = !selectedItem;
      // Split into list + viewer only while something is open in two columns.
      layout.classList.toggle('is-split', Boolean(selectedItem) && !singleColumn.matches);
    };

    function select(item) {
      selectedItem = item;
      items.forEach((candidate) => {
        const isSelected = candidate === item;
        candidate.classList.toggle('is-selected', isSelected);
        linkFor(candidate)?.setAttribute('aria-expanded', String(isSelected));
      });
      const source = item && document.getElementById(idFor(item));
      viewer.replaceChildren(...(source ? [copyOf(source), closeButton] : []));
      viewer.scrollTop = 0;
      placeViewer();
      document.dispatchEvent(new Event('reportviewerchange'));
    }

    // Open an item from anywhere (other pages, matrix tiles, the Bug List
    // drawer) and bring it to the top of the screen.
    const open = (item, { behavior } = {}) => {
      if (item !== selectedItem) select(item);
      item.scrollIntoView({ block: 'start', behavior });
    };

    items.forEach((item) => {
      const link = linkFor(item);
      if (!link) return;
      link.setAttribute('aria-controls', viewer.id);
      link.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const closing = item === selectedItem;
        select(closing ? null : item);
        // Single column: keep the opened item's title at the top of the screen.
        if (!closing && singleColumn.matches) item.scrollIntoView({ block: 'start' });
      });
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || list.contains(link) || viewer.contains(link) || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const item = itemFor(link.getAttribute('href').slice(1));
      if (!item) return;
      event.preventDefault();
      open(item);
    });
    window.addEventListener('hashchange', () => {
      const item = itemFor(decodeURIComponent(window.location.hash.slice(1)));
      if (item) open(item);
    });

    sources.hidden = true;
    layout.classList.add('has-viewer');
    singleColumn.addEventListener('change', placeViewer);

    const linkedItem = itemFor(decodeURIComponent(window.location.hash.slice(1)));
    if (linkedItem) {
      // Arrived from a link to one item (e.g. "View full solution" on the Bug
      // Report page). Scroll after the sticky-bar offsets are measured in setup.
      select(linkedItem);
      requestAnimationFrame(() => open(linkedItem, { behavior: 'instant' }));
    } else {
      // Optionally open the first item in two columns so the viewer isn't
      // empty. One column always starts closed so the list stays scannable.
      select(openFirst && !singleColumn.matches ? items.find((item) => !item.classList.contains('filtered-out')) || null : null);
    }
  }

  function setupListViewers() {
    const page = document.documentElement.dataset.page;
    if (page === 'bugs') {
      const directory = document.getElementById('bug-directory-list');
      setupListViewer({
        layout: directory?.closest('.directory-layout'),
        list: directory,
        items: Array.from(directory?.querySelectorAll('tbody tr[id^="assignment-"]') || []),
        viewer: document.getElementById('report-viewer'),
        sources: document.getElementById('bug-guide-cards'),
        closeLabel: '↑ Close report',
        tip: 'Click a bug’s title to see its full report.',
        // Start with just the list, so the tip makes sense.
        openFirst: false,
      });
    } else if (page === 'solutions') {
      const toc = document.getElementById('solution-toc');
      setupListViewer({
        layout: toc?.closest('.solution-layout'),
        list: toc,
        items: Array.from(toc?.querySelectorAll('li') || []),
        viewer: document.getElementById('solution-viewer'),
        sources: document.getElementById('solution-list'),
        closeLabel: '↑ Close solution',
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupLaunchWidget();
    setupBugGuides();
    setupCollapsibleSections();

    setupHints(document);
    setupListViewers();

    const filterPanelToggle = document.getElementById('filter-panel-toggle');
    if (filterPanelToggle) {
      filterPanelToggle.addEventListener('click', () => {
        const isExpanded = filterPanelToggle.getAttribute('aria-expanded') === 'true';
        filterPanelToggle.setAttribute('aria-expanded', String(!isExpanded));
      });
    }

    const inlineToc = document.getElementById('bug-directory-list') || document.querySelector('.triage-table');
    const drawerToggle = document.getElementById('toc-drawer-toggle');
    const sidebar = document.getElementById('bug-guide-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const closeDrawerButton = document.getElementById('close-drawer-btn');

    if (drawerToggle && sidebar && sidebarOverlay) {
      const setSidebarOpen = (isOpen) => {
        sidebar.classList.toggle('open', isOpen);
        sidebarOverlay.classList.toggle('show', isOpen);
        drawerToggle.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
          (sidebar.querySelector('.toc-link:not([hidden])') || document.getElementById('sidebar-clear-filters'))?.focus();
        } else if (sidebar.contains(document.activeElement)) {
          drawerToggle.focus();
        }
      };

      drawerToggle.setAttribute('aria-expanded', 'false');
      drawerToggle.addEventListener('click', () => {
        setSidebarOpen(!sidebar.classList.contains('open'));
      });
      closeDrawerButton?.addEventListener('click', () => setSidebarOpen(false));
      sidebarOverlay.addEventListener('click', () => setSidebarOpen(false));
      sidebar.querySelectorAll('.toc-link').forEach((link) => {
        link.addEventListener('click', () => setSidebarOpen(false));
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && sidebar.classList.contains('open')) {
          setSidebarOpen(false);
        }
      });
    }

    const sectionNav = document.querySelector('.section-nav');
    const stickyFilters = document.getElementById('bug-filter-toolbar');
    const syncAnchorSpacing = () => {
      const navHeight = sectionNav?.getBoundingClientRect().height || 0;
      const filterHeight = stickyFilters?.getBoundingClientRect().height || 0;
      document.documentElement.style.setProperty('--bug-nav-height', Math.ceil(navHeight) + 'px');
      document.documentElement.style.setProperty('--bug-anchor-offset', Math.ceil(navHeight + filterHeight + 20) + 'px');
    };
    syncAnchorSpacing();
    if (typeof ResizeObserver !== 'undefined') {
      const stickySizeObserver = new ResizeObserver(syncAnchorSpacing);
      if (sectionNav) stickySizeObserver.observe(sectionNav);
      if (stickyFilters) stickySizeObserver.observe(stickyFilters);
    }
    window.addEventListener('resize', syncAnchorSpacing);
    // Refresh measurements before native anchor navigation, including drawer links.
    document.addEventListener('click', (event) => {
      if (event.target.closest('a[href^="#"]')) syncAnchorSpacing();
    }, true);


    const syncTocNavigation = () => {
      const stickyNavBottom = sectionNav ? sectionNav.getBoundingClientRect().bottom : 0;
      const isPastToc = Boolean(inlineToc && inlineToc.getBoundingClientRect().bottom <= stickyNavBottom);
      drawerToggle?.classList.toggle('visible', isPastToc);
      sidebar?.classList.toggle('past-toc', isPastToc);
    };

    syncTocNavigation();
    window.addEventListener('scroll', syncTocNavigation, { passive: true });
    window.addEventListener('resize', syncTocNavigation);

    if (sectionNav && sidebar) {
      syncTocNavigation();
    }
  });
})();
