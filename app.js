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
    const cards = bugCardsContainer.querySelectorAll('.bug-guide-card');
    const empty = document.getElementById('bug-guide-empty');

    if (!cards.length) return;

    const state = { type: 'all', reporter: 'all' };
    const storageKey = 'bugblitz-guide-triage-v1';
    const assignments = Object.create(null);
    const options = { priority: ['', 'P1', 'P2', 'P3'], effort: ['', 'Low', 'Medium', 'High'] };
    const toc = document.querySelector('.triage-table tbody');
    const priorityLabels = { P1: 'P1 (High)', P2: 'P2 (Medium)', P3: 'P3 (Low)' };
    const tileTitles = {
      'welcome-offer-mobile': 'Welcome offer is overlapped on mobile',
      'duplicate-order-placed': 'Double-click creates duplicate orders',
      'generic-error': 'Checkout error doesn’t identify fields',
      'international-postal-code': 'Valid international addresses rejected',
      'stale-state': 'Country change keeps old province',
      'sold-out-feedback': 'Sold-out Add to Cart does nothing',
      'broken-image': 'Product photo is broken',
      'dialog-bug': 'Clear Cart dialog leaves page frozen',
      'promo-duplicate': 'Same promo code discounts repeatedly',
      'sale-price-not-honored': 'Totals ignore sale prices',
      'stale-search': 'Old search results replace new ones'
    };
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

    if (typeof ResizeObserver !== 'undefined' && zones.length) {
      const tileWidthObserver = new ResizeObserver(([measurement]) => {
        if (measurement.contentRect.width > 0) {
          pending.style.setProperty('--matrix-tile-width', measurement.contentRect.width + 'px');
        }
      });
      tileWidthObserver.observe(zones[0].querySelector('.board-tiles'));
    }

    const status = document.getElementById('triage-status');
    const count = document.getElementById('triage-count');
    const entries = [];
    let draggedEntry = null;

    function finishDrag() {
      if (draggedEntry) {
        draggedEntry.tile.classList.remove('dragging');
        draggedEntry.tile.classList.remove('drag-source');
      }
      draggedEntry = null;
      zones.forEach((zone) => zone.classList.remove('drop-target'));
    }

    function summary(value) {
      return (priorityLabels[value.priority] || 'Priority unassigned') + ' · ' + (value.effort ? value.effort + ' effort' : 'Effort unassigned');
    }

    function saveAssignment(entry) {
      render();
      if (status) {
        status.textContent = entry.title + ': ' + summary(assignments[entry.card.id]) + '.';
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(assignments));
      } catch (_) {
        if (status) {
          status.textContent += ' Saved for this visit only; browser storage is unavailable.';
        }
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
          : 'Set missing values in the Bug Directory below to place these bugs in the matrix.';
      }
    }

    cards.forEach((card) => {
      const title = tileTitles[card.id] || card.querySelector('h3').textContent;
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
          saveAssignment(entry);
        });

        if (row) {
          const fieldCell = row.querySelector('[data-label="' + fieldName + '"]');
          if (fieldCell) fieldCell.append(select);
        }
      });
    });

    zones.forEach((zone) => {
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
        assignments[entry.card.id] = { priority: zone.dataset.priority, effort: zone.dataset.effort };
        finishDrag();
        saveAssignment(entry);
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
    let lastScrollY = window.scrollY;
    let scrollDirection = 'down';

    function updateActiveBugLink() {
      const sectionNavBottom = document.querySelector('.section-nav')?.getBoundingClientRect().bottom || 0;
      const filterBottom = toolbar.getBoundingClientRect().bottom;
      const contentTop = Math.max(sectionNavBottom, filterBottom);
      const availableHeight = Math.max(0, window.innerHeight - contentTop);
      const activeLine = contentTop + availableHeight * (scrollDirection === 'up' ? 0.62 : 0.35);
      const visibleCards = Array.from(bugCards).filter((card) => !card.classList.contains('hidden'));
      let activeCard = null;

      visibleCards.forEach((card) => {
        if (card.getBoundingClientRect().top <= activeLine) activeCard = card;
      });
      if (!activeCard) {
        activeCard = visibleCards.find((card) => {
          const bounds = card.getBoundingClientRect();
          return bounds.top < window.innerHeight && bounds.bottom > sectionNavBottom;
        }) || null;
      }

      sidebarBugLinks.forEach((link) => {
        const isCurrent = activeCard && link.getAttribute('href') === '#' + activeCard.id;
        if (isCurrent) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function updateActiveBugLinkOnScroll() {
      const currentScrollY = window.scrollY;
      if (currentScrollY !== lastScrollY) {
        scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
        lastScrollY = currentScrollY;
      }
      updateActiveBugLink();
    }

    window.addEventListener('scroll', updateActiveBugLinkOnScroll, { passive: true });
    window.addEventListener('resize', updateActiveBugLink);

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

  document.addEventListener('DOMContentLoaded', () => {
    setupLaunchWidget();
    setupBugGuides();

    // Native disclosures remain usable without JavaScript. With JavaScript,
    // reveal the next control only after the preceding hint has been opened.
    document.querySelectorAll('.bug-hints').forEach((group) => {
      const hints = Array.from(group.querySelectorAll('.bug-hint'));
      hints.forEach((hint, index) => {
        hint.hidden = index > 0;
        hint.addEventListener('toggle', () => {
          if (hint.open && hints[index + 1]) hints[index + 1].hidden = false;
        });
      });
    });

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
