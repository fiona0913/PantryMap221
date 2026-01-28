(function() {
  'use strict';

  // Global state
  let map;
  let markers = new Map();
  let currentPantry = null;
  let allPantries = [];
  let wishlistState = {
    items: [],
    pantryId: null
  };
  let messageState = {
    items: [],
    pantryId: null,
    root: null
  };
  let wishlistModal = null;
  const listControlsState = {
    type: 'all', // all | fridge | shelf
    stock: 'any', // any | high-low | low-high
    restock: 'newest', // newest | oldest
  };

  // Inline SVG placeholders (data URIs) for missing images
  const PLACEHOLDERS = {
    pantry: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="%23f0fdf4"/><stop offset="100%" stop-color="%23dcfce7"/></linearGradient></defs><rect width="1200" height="800" fill="url(%23g)"/><g fill="%2392ceac" opacity="0.45"><circle cx="180" cy="160" r="8"/><circle cx="300" cy="120" r="4"/><circle cx="1080" cy="180" r="6"/><circle cx="980" cy="620" r="8"/></g><g transform="translate(0,10)" fill="none" stroke="%2352b788" stroke-width="22"><circle cx="600" cy="420" r="120"/><circle cx="600" cy="420" r="38" fill="%2352b788"/></g><text x="600" y="720" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial" font-size="36" fill="%232c3e50" opacity="0.7">Pantry photo</text></svg>',
    avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="%23eaf7f0"/><circle cx="40" cy="32" r="16" fill="%2352b788"/><path d="M12 70c6-12 20-18 28-18s22 6 28 18" fill="none" stroke="%2352b788" stroke-width="6" stroke-linecap="round"/></svg>',
    photo: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" rx="10" fill="%23f1f5f9"/><path d="M20 92l28-32 18 20 22-26 32 38H20z" fill="%2394a3b8"/><circle cx="52" cy="40" r="10" fill="%2394a3b8"/></svg>'
  };

  function pantryPhotoTag(url, alt, extraAttrs = '') {
    const src = url && typeof url === 'string' ? url : PLACEHOLDERS.pantry;
    const safeAlt = alt ? alt.replace(/"/g, '&quot;') : 'Pantry photo';
    return `<img data-role='pantry-photo' src='${src}' alt='${safeAlt}' ${extraAttrs}>`;
  }

  function avatarTag(url, size = 40, alt = 'User avatar') {
    const src = url && typeof url === 'string' ? url : PLACEHOLDERS.avatar;
    const style = `width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover;`;
    const safeAlt = alt.replace(/"/g, '&quot;');
    return `<img data-role='avatar' src='${src}' alt='${safeAlt}' style='${style}'>`;
  }

  function contentPhotoTag(url, size = 60, alt = '') {
    const src = url && typeof url === 'string' ? url : PLACEHOLDERS.photo;
    const style = `width: ${size}px; height: ${size}px; border-radius: 8px; object-fit: cover;`;
    const safeAlt = (alt || 'Photo').replace(/"/g, '&quot;');
    return `<img data-role='content-photo' src='${src}' alt='${safeAlt}' style='${style}'>`;
  }

  function renderStockGauge(currentItems = 0, capacity = 40) {
    const safeCurrent = Number.isFinite(currentItems) ? currentItems : 0;
    const ratio = Math.max(0, Math.min(safeCurrent / capacity, 1));
    const statusLabel = ratio >= 0.75 ? 'Full' : (ratio >= 0.4 ? 'Medium' : 'Low');
    const radius = 80;
    const circumference = Math.PI * radius;
    const dashOffset = circumference * (1 - ratio);
    return `
      <div class="detail-gauge">
        <svg viewBox="0 0 200 120" class="detail-gauge-svg" role="img" aria-label="Stock level">
          <path class="detail-gauge-track" d="M20 100 A80 80 0 0 1 180 100" />
          <path class="detail-gauge-fill" d="M20 100 A80 80 0 0 1 180 100"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}" />
        </svg>
        <div class="detail-gauge-center">
          <div class="detail-gauge-status">${statusLabel}</div>
          <div class="detail-gauge-count">${safeCurrent} Items</div>
        </div>
      </div>
    `;
  }

  function formatDateTimeMinutes(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  function formatWeightDisplay(weight) {
    if (weight === null || weight === undefined || Number.isNaN(Number(weight))) return '--';
    const num = Number(weight);
    return `${num.toFixed(1)} kg`;
  }

  function formatDoorEvent(value) {
    if (!value) return '--';
    const lower = String(value).toLowerCase();
    if (lower === 'open' || lower === 'opened') return 'Opened';
    if (lower === 'closed' || lower === 'close') return 'Closed';
    return value;
  }

  function formatCondition(value) {
    if (!value) return '--';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function formatRelativeTimestamp(isoString) {
    if (!isoString) return 'No recent uploads';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return formatDateTimeMinutes(isoString);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return formatDateTimeMinutes(isoString);
  }

  function attachImageFallbacks(container) {
    const nodes = container.querySelectorAll('img[data-role]');
    nodes.forEach(img => {
      const role = img.getAttribute('data-role');
      const fallback = role === 'avatar' ? PLACEHOLDERS.avatar : (role === 'pantry-photo' ? PLACEHOLDERS.pantry : PLACEHOLDERS.photo);
      const ensure = () => { if (!img.getAttribute('src')) img.setAttribute('src', fallback); };
      ensure();
      img.addEventListener('error', () => { img.setAttribute('src', fallback); });
    });
  }

  // Initialize the application
  async function init() {
    console.log('Initializing Pantry Map Dashboard...');
    
    // Initialize the map
    initMap();
    
    // Load pantry data and create markers
    await loadPantries();
    // Render list for current view when no selection
    showListForCurrentView();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log('Dashboard initialized successfully');
  }

  // Initialize Leaflet map
  function initMap() {
    // Create map centered on Seattle area (where most pantries are)
    map = L.map('map').setView([47.6062, -122.3321], 11);
    
    // Add Google-like basemap tiles (CARTO Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    
    // Position zoom control similar to Google Maps (top right)
    map.zoomControl.setPosition('topright');
    
    // Optional scale control
    L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);
    
    console.log('Map initialized');
    // Update list as user moves/zooms the map, only if no pantry selected
    map.on('moveend', () => {
      if (!currentPantry) showListForCurrentView();
    });
  }

  // Load pantries from API and create markers
  async function loadPantries() {
    try {
      console.log('Loading pantries...');
      const pantries = await window.PantryAPI.getPantries();
      allPantries = pantries;
      console.log(`Loaded ${pantries.length} pantries`);
      
      // Create markers for each pantry
      pantries.forEach(pantry => {
        createPantryMarker(pantry);
      });
      
    } catch (error) {
      console.error('Error loading pantries:', error);
    }
  }

  function showListForCurrentView() {
    if (!map) return;
    const bounds = map.getBounds();
    let inView = allPantries.filter(p => {
      const { lat, lng } = p.location || {};
      return typeof lat === 'number' && typeof lng === 'number' && bounds.contains([lat, lng]);
    }).slice(0, 50);
    // Apply type filter
    if (listControlsState.type !== 'all') {
      inView = inView.filter(p => (p.pantryType || '').toLowerCase() === listControlsState.type);
    }
    // Compute stock level for sorting
    const withStock = inView.map(p => ({
      p,
      stock: (p.inventory && Array.isArray(p.inventory.categories)) ? p.inventory.categories.reduce((s, c) => s + (c.quantity || 0), 0) : 0,
      updated: p.sensors && p.sensors.updatedAt ? new Date(p.sensors.updatedAt).getTime() : 0,
    }));
    // Stock sorting
    if (listControlsState.stock === 'high-low') withStock.sort((a,b)=>b.stock - a.stock);
    if (listControlsState.stock === 'low-high') withStock.sort((a,b)=>a.stock - b.stock);
    // Restock sorting
    if (listControlsState.restock === 'newest') withStock.sort((a,b)=>b.updated - a.updated);
    if (listControlsState.restock === 'oldest') withStock.sort((a,b)=>a.updated - b.updated);
    inView = withStock.map(x=>x.p);

    const detailsPanel = document.getElementById('details');
    const detailsContent = document.getElementById('detailsContent');
    detailsPanel.classList.remove('hidden');
    detailsContent.innerHTML = renderPantryList(inView);
    attachImageFallbacks(detailsContent);
    updateCollapseButton(false);
  }

  function renderPantryList(items) {
    if (!items || items.length === 0) {
      return `
        <h2>Pantries in view</h2>
        <div class="empty">No pantries in the current view.</div>
      `;
    }
    return `
      <h2>Pantries in view (${items.length})</h2>
      <div class="list-controls">
        <label>
          <span>Type</span>
          <select id="listType">
            <option value="all" ${listControlsState.type==='all'?'selected':''}>All</option>
            <option value="fridge" ${listControlsState.type==='fridge'?'selected':''}>Fridge</option>
            <option value="shelf" ${listControlsState.type==='shelf'?'selected':''}>Shelf</option>
          </select>
        </label>
        <label>
          <span>Stock Level</span>
          <select id="listStock">
            <option value="any" ${listControlsState.stock==='any'?'selected':''}>Any</option>
            <option value="high-low" ${listControlsState.stock==='high-low'?'selected':''}>High → Low</option>
            <option value="low-high" ${listControlsState.stock==='low-high'?'selected':''}>Low → High</option>
          </select>
        </label>
        <label>
          <span>Last Restock</span>
          <select id="listRestock">
            <option value="newest" ${listControlsState.restock==='newest'?'selected':''}>Newest</option>
            <option value="oldest" ${listControlsState.restock==='oldest'?'selected':''}>Oldest</option>
          </select>
        </label>
      </div>
      <div class="list">
        ${items.map(p => renderListItem(p)).join('')}
      </div>
    `;
  }

  function getTotalStock(pantry) {
    return (pantry.inventory && Array.isArray(pantry.inventory.categories))
      ? pantry.inventory.categories.reduce((s, c) => s + (c.quantity || 0), 0)
      : 0;
  }

  function getStockBadge(total) {
    if (total <= 10) return { label: 'Low Stock', cls: 'low' };
    if (total <= 30) return { label: 'Medium Stock', cls: 'medium' };
    return { label: 'In Stock', cls: 'high' };
  }

  function formatRelativeDays(iso) {
    if (!iso) return 'Unknown';
    const t = new Date(iso).getTime();
    if (!t) return 'Unknown';
    const diff = Math.max(0, Date.now() - t);
    const days = Math.floor(diff / (24*60*60*1000));
    if (days === 0) return 'Restocked within 1 day';
    if (days === 1) return 'Restocked 1 day ago';
    return `Restocked ${days} days ago`;
  }

  function renderListItem(p) {
    const title = p.name || 'Untitled Pantry';
    const addrLine = (p.address || '').trim();
    const distance = '1 mi';
    const photo = (p.photos && p.photos[0]) || null;
    const total = getTotalStock(p);
    const stock = getStockBadge(total);
    const restock = formatRelativeDays(p.sensors && p.sensors.updatedAt);
    return `
      <button class="list-card list-item" data-id="${p.id}">
        <div class="thumb">${contentPhotoTag(photo, 72, title)}</div>
        <div class="list-main">
          <div class="list-row">
            <div class="list-title">${title}</div>
            <div class="list-distance">${distance}</div>
          </div>
          <div class="list-address">${addrLine}</div>
          <div class="list-meta">
            <span class="stock ${stock.cls}">${stock.label}</span>
            <span class="dot">•</span>
            <span class="restock">${restock}</span>
          </div>
        </div>
        <div class="chevron">›</div>
      </button>
    `;
  }

  // Create a marker for a pantry
  function createPantryMarker(pantry) {
    if (!pantry.location || !pantry.location.lat || !pantry.location.lng) {
      console.warn('Pantry missing location data:', pantry.id);
      return;
    }
    
    console.log(`Creating marker for ${pantry.name} at [${pantry.location.lat}, ${pantry.location.lng}]`);

    // Determine marker color based on status
    const statusColors = {
      'open': '#52b788',
      'closed': '#ef4444',
      'low-inventory': '#f59e0b'
    };
    
    const color = statusColors[pantry.status] || statusColors['open'];
    
    // Create custom icon with green marker style
    const icon = L.divIcon({
      className: 'pantry-marker',
      html: `<div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 3px 8px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
        <div style="
          width: 12px;
          height: 12px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Create marker
    const marker = L.marker([pantry.location.lat, pantry.location.lng], { icon })
      .addTo(map);
    
    // Add click handler
    marker.on('click', () => {
      showPantryDetails(pantry);
    });
    
    // Store marker reference
    markers.set(pantry.id, marker);
  }

  // Show pantry details in side panel
  function showPantryDetails(pantry) {
    currentPantry = pantry;
    
    // Update details content
    const detailsContent = document.getElementById('detailsContent');
    detailsContent.innerHTML = renderPantryDetails(pantry);
    // Ensure images gracefully fallback
    attachImageFallbacks(detailsContent);
    // Initialize carousel if present
    setupCarousel(detailsContent);
    // Load latest live pantry photo
    loadLatestLivePhoto(pantry);
    bindLivePhotoUploader(detailsContent, pantry);
    bindWishlistModule(detailsContent, pantry);
    bindMessageModule(detailsContent, pantry);
    
    // Show details panel
    const detailsPanel = document.getElementById('details');
    detailsPanel.classList.remove('hidden');
    detailsPanel.classList.remove('collapsed');
    updateCollapseButton(false);
    
    // Pan/zoom map to marker
    const marker = markers.get(pantry.id);
    if (marker) {
      const target = marker.getLatLng();
      const targetZoom = Math.max(map.getZoom(), 16);
      if (map.flyTo) {
        map.flyTo(target, targetZoom, { animate: true, duration: 0.5 });
      } else {
        map.setView(target, targetZoom);
      }
    } else if (pantry.location && typeof pantry.location.lat === 'number' && typeof pantry.location.lng === 'number') {
      const target = [pantry.location.lat, pantry.location.lng];
      const targetZoom = Math.max(map.getZoom(), 16);
      map.setView(target, targetZoom);
    }
  }

  // Render pantry details HTML
  function renderPantryDetails(pantry) {
    const photosArr = Array.isArray(pantry.photos) ? pantry.photos : [];
    const photoUrl = photosArr.length > 0 ? photosArr[0] : '';
    const secondPhotoUrl = photosArr[1] || photosArr[0] || '';
    const totalItems = pantry.inventory?.categories?.reduce((sum, cat) => sum + (cat.quantity || 0), 0) || 0;
    const contactName = pantry.contact?.owner || 'Jane';
    const contactEmail = pantry.contact?.email || pantry.contact?.emailAddress || 'abcd@gmail.com';
    const distanceText = pantry.distance || '1 mi';
    const addressText = pantry.address || '123 1st St, Bellevue, 98005';
    const description = pantry.description || pantry.summary || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const livePhotoPlaceholderTime = 'No recent uploads';
    const pantryTypeLabel = pantry.pantryType
      ? pantry.pantryType.charAt(0).toUpperCase() + pantry.pantryType.slice(1)
      : 'Pantry';
    const contactLine = contactEmail
      ? `${contactName} (<a href="mailto:${contactEmail}">${contactEmail}</a>)`
      : contactName;
    const sensors = pantry.sensors || {};
    const telemetryMarkup = `
      <section class="detail-section telemetry-section">
        <div class="section-heading-row">
          <h2>Sensor data</h2>
        </div>
        <div class="telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">Weight</span>
            <span class="telemetry-value">${formatWeightDisplay(sensors.weightKg)}</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Last activity</span>
            <span class="telemetry-value">${formatDoorEvent(sensors.lastDoorEvent)}</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Updated</span>
            <span class="telemetry-value">${sensors.updatedAt ? formatDateTimeMinutes(sensors.updatedAt) : '--'}</span>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">Condition</span>
            <span class="telemetry-pill">${formatCondition(sensors.foodCondition)}</span>
          </div>
        </div>
      </section>
    `;

    return `
      <div class="detail-hero">
        <div class="detail-hero-cover">
          ${pantryPhotoTag(photoUrl, pantry.name || 'Pantry photo', 'class="detail-hero-img"')}
          <span class="detail-hero-badge">${pantryTypeLabel}</span>
          <button class="detail-floating-btn detail-upload" type="button" aria-label="Upload donation photo">⇪</button>
        </div>
        <div class="detail-hero-body">
          <h1 class="detail-title">${pantry.name || 'Untitled Pantry'}</h1>
          <div class="detail-subline">${distanceText} · ${addressText}</div>
          <p class="detail-description">${description}</p>
          <div class="detail-contact">
            <span class="detail-contact-icon">👤</span>
            <div class="detail-contact-info"><span>${contactLine}</span></div>
          </div>
        </div>
      </div>

      <section class="detail-section stock-section">
        <div class="stock-card">
          <div class="stock-card-head">
            <h2>Stock level</h2>
          </div>
          ${renderStockGauge(totalItems)}
        </div>
        <div class="stock-side">
          <div class="live-photo-card" data-live-photo>
            <div class="live-photo-thumb">
              ${contentPhotoTag(null, 160, `${pantry.name || 'Pantry'} live pantry photo`)}
              <span class="live-photo-ts" data-live-photo-ts>${livePhotoPlaceholderTime}</span>
            </div>
            <button class="live-photo-upload" type="button" data-live-photo-upload>Upload new photo</button>
          </div>
        </div>
      </section>

      ${telemetryMarkup}

      <section class="detail-section wishlist-section" data-wishlist>
        <div class="section-heading-row">
          <h2>Pantry Wishlist</h2>
          <button class="wishlist-add" type="button" aria-label="Add wishlist item" data-wishlist-add>+</button>
        </div>
        <div class="wishlist-grid" data-wishlist-grid>
          <div class="wishlist-empty">Loading wishlist…</div>
        </div>
      </section>

      <section class="detail-section message-section">
        <h2>Leave a message</h2>
        <button class="message-cta" type="button" data-message-add>Leave a message to the host and the community</button>
        <div class="message-list" data-message-list>
          <div class="message-empty">Loading messages…</div>
        </div>
      </section>
    `;
  }

  // Set up event listeners
  function setupEventListeners() {
    // Close details panel
    const closeBtn = document.getElementById('closeDetails');
    closeBtn.addEventListener('click', () => {
      const detailsPanel = document.getElementById('details');
      // Toggle collapsed state instead of hide
      const willCollapse = !detailsPanel.classList.contains('collapsed');
      detailsPanel.classList.toggle('collapsed', willCollapse);
      if (willCollapse) {
        // Keep list hidden when collapsing from details; user can expand again
        currentPantry = null;
      } else {
        // Expanded back; if no pantry selected, show list
        if (!currentPantry) showListForCurrentView();
      }
      updateCollapseButton(detailsPanel.classList.contains('collapsed'));
    });
    
    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        filterPantriesByStatus(e.target.value);
      });
    }

    // Delegate clicks on list items to open details
    const detailsContent = document.getElementById('detailsContent');
    if (detailsContent) {
      detailsContent.addEventListener('click', (e) => {
        const target = e.target.closest('.list-item');
        if (target) {
          e.preventDefault();
          const id = target.getAttribute('data-id');
          const p = allPantries.find(x => String(x.id) === String(id));
          if (p) showPantryDetails(p);
        }
      });
      // keyboard support
      detailsContent.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('list-item')) {
          e.preventDefault();
          const id = e.target.getAttribute('data-id');
          const p = allPantries.find(x => String(x.id) === String(id));
          if (p) showPantryDetails(p);
        }
      });
    }

    // Controls change events
    detailsContent.addEventListener('change', (e) => {
      const t = e.target;
      if (t && t.id === 'listType') { listControlsState.type = t.value; showListForCurrentView(); }
      if (t && t.id === 'listStock') { listControlsState.stock = t.value; showListForCurrentView(); }
      if (t && t.id === 'listRestock') { listControlsState.restock = t.value; showListForCurrentView(); }
    });

    // Fallback global delegation (in case list re-renders before handlers attach)
    document.addEventListener('click', (e) => {
      const target = e.target && e.target.closest && e.target.closest('.list-item');
      if (target) {
        e.preventDefault();
        const id = target.getAttribute('data-id');
        const p = allPantries.find(x => String(x.id) === String(id));
        if (p) showPantryDetails(p);
      }
    });
  }

  function updateCollapseButton(isCollapsed) {
    const btn = document.getElementById('closeDetails');
    if (!btn) return;
    btn.textContent = isCollapsed ? '›' : '←';
    btn.setAttribute('aria-label', isCollapsed ? 'Expand details' : 'Back to list');
  }

  async function loadLatestLivePhoto(pantry) {
    if (!pantry || !pantry.id) return;
    const container = document.querySelector('[data-live-photo]');
    if (!container) return;
    const img = container.querySelector('img[data-role="content-photo"]');
    const tsEl = container.querySelector('[data-live-photo-ts]');
    try {
      const items = await window.PantryAPI.getDonations(pantry.id, 1, 1);
      if (Array.isArray(items) && items.length > 0) {
        const latest = items[0];
        const photos = latest.photoUrls || latest.photos || latest.images || [];
        const photoUrl = Array.isArray(photos) ? photos[0] : photos;
        if (photoUrl && img) {
          img.src = photoUrl;
        }
        if (tsEl) {
          const ts = latest.time || latest.createdAt || latest.updatedAt || latest.timestamp;
          tsEl.textContent = ts ? formatRelativeTimestamp(ts) : 'Just now';
        }
        attachImageFallbacks(container);
      } else if (tsEl) {
        tsEl.textContent = 'No recent uploads';
      }
    } catch (error) {
      console.error('Error loading latest live photo:', error);
      if (tsEl) tsEl.textContent = 'Failed to load';
    }
  }

  function bindLivePhotoUploader(root, pantry) {
    if (!root) return;
    const btn = root.querySelector('[data-live-photo-upload]');
    if (!btn) return;
    let input = root.querySelector('input[type="file"][data-live-photo-input]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.setAttribute('data-live-photo-input', 'true');
      root.appendChild(input);
    }
    btn.onclick = () => input.click();
    input.onchange = (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        console.log('Selected live pantry photo for upload', pantry.id, file);
        // TODO: implement upload flow to backend
      }
    };
  }

  function bindWishlistModule(root, pantry) {
    if (!root || !pantry || !pantry.id) return;
    const grid = root.querySelector('[data-wishlist-grid]');
    const addBtn = root.querySelector('[data-wishlist-add]');
    if (!grid || !addBtn) return;

    const refresh = (prefetched) => loadWishlist(pantry, grid, prefetched);
    addBtn.onclick = () => openWishlistModal(pantry, refresh);
    refresh();
  }

  function normalizeItemName(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function aggregateWishlistItems(rawItems = []) {
    if (!Array.isArray(rawItems)) return [];
    const buckets = new Map();

    rawItems.forEach((entry, index) => {
      if (entry == null) return;
      const candidate = typeof entry === 'string' ? { itemDisplay: entry, count: 1 } : entry;
      const display = normalizeItemName(
        candidate.itemDisplay ??
          candidate.item ??
          candidate.name ??
          candidate.title ??
          candidate.id
      );
      if (!display) return;
      const key = normalizeItemName(display).toLowerCase();
      if (!key) return;

      const rawCount = Number(candidate.count ?? candidate.quantity ?? candidate.qty);
      const count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1;
      const updatedAt = candidate.updatedAt ?? candidate.modified ?? candidate.createdAt ?? candidate.timestamp ?? null;

      const existing = buckets.get(key);
      if (existing) {
        existing.count += count;
        if (!existing.updatedAt && updatedAt) {
          existing.updatedAt = updatedAt;
        }
      } else {
        buckets.set(key, {
          id: candidate.id ?? `agg-${key || index}`,
          itemDisplay: display,
          count,
          updatedAt: updatedAt ?? null,
        });
      }
    });

    return Array.from(buckets.values());
  }

  function normalizeWishlistItems(rawItems = []) {
    return aggregateWishlistItems(rawItems);
  }

  function toWishlistArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  async function loadWishlist(pantry, grid, prefetchedData) {
    if (!grid) return;
    if (prefetchedData === undefined) {
      grid.innerHTML = `<div class="wishlist-empty">Loading wishlist…</div>`;
    }
    try {
      const data = prefetchedData ?? (await window.PantryAPI.getWishlist(pantry.id));
      let items = toWishlistArray(data);
      if ((!items || items.length === 0) && Array.isArray(pantry.wishlist) && pantry.wishlist.length) {
        items = pantry.wishlist.map((name, idx) => ({
          id: `legacy-${idx}`,
          itemDisplay: name,
          count: 1,
          updatedAt: null
        }));
      }
      const normalized = normalizeWishlistItems(items);
      wishlistState.items = normalized;
      wishlistState.pantryId = pantry.id;
      renderWishlistItems(grid, normalized);
    } catch (error) {
      console.error('Error loading wishlist:', error);
      grid.innerHTML = `<div class="wishlist-empty">Unable to load wishlist right now.</div>`;
    }
  }

  function renderWishlistItems(grid, items) {
    grid.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      grid.innerHTML = `<div class="wishlist-empty">No wishlist items in the last 7 days.</div>`;
      return;
    }
    items.forEach(item => {
      const qty = Number.isFinite(item.count) && item.count > 0 ? item.count : 1; // Backend aggregates count
      const timestamp = item.updatedAt || item.createdAt || null; // Prefer freshest timestamp regardless of field name
      const itemDisplay = normalizeItemName(item.itemDisplay ?? item.id ?? 'Item'); // Use backend agg label
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'wishlist-chip';
      pill.title = timestamp ? `Updated ${formatRelativeTimestamp(timestamp)}` : '';
      pill.textContent = qty > 1 ? `${itemDisplay} × ${qty}` : itemDisplay; // Surface quantity inline when greater than one
      pill.addEventListener('click', async () => {
        if (!wishlistState.pantryId) return;
        const pantryId = String(wishlistState.pantryId);
        try {
          const updated = await window.PantryAPI.addWishlist(pantryId, itemDisplay, 1);
          const refreshed = normalizeWishlistItems(toWishlistArray(updated)); // Merge duplicates after re-fetch
          wishlistState.items = refreshed;
          renderWishlistItems(grid, refreshed);
        } catch (err) {
          console.error('Error re-adding wishlist item:', err);
        }
      });
      grid.appendChild(pill);
    });
  }

  async function loadMessages(pantry) {
    if (!pantry || !pantry.id || !messageState.root) return;
    const container = messageState.root;
    container.innerHTML = `<div class="message-empty">Loading messages…</div>`;
    try {
      const pantryId = String(pantry.id);
      const data = await window.PantryAPI.getMessages(pantryId);
      const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      messageState.items = items;
      messageState.pantryId = pantryId;
      renderMessages(items);
    } catch (error) {
      console.error('Error loading messages:', error);
      container.innerHTML = `<div class="message-empty">Unable to load messages right now.</div>`;
    }
  }

  function renderMessages(items) {
    const container = messageState.root;
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `<div class="message-empty">No messages yet.</div>`;
      return;
    }

    items.forEach((msg) => {
      const userName = (msg && (msg.userName || msg.name)) || 'Community member';
      const avatarUrl = msg?.userAvatar || msg?.avatarUrl || null;
      const content = msg?.content || msg?.message || '';
      const createdAt = msg?.createdAt || msg?.timestamp || msg?.time || '';
      const photos = Array.isArray(msg?.photos)
        ? msg.photos
        : (Array.isArray(msg?.images) ? msg.images : []);

      const card = document.createElement('article');
      card.className = 'message-card';

      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.innerHTML = avatarTag(avatarUrl, 40, userName);
      card.appendChild(avatar);

      const body = document.createElement('div');
      body.className = 'message-body';

      const heading = document.createElement('h3');
      heading.textContent = userName;
      body.appendChild(heading);

      if (content) {
        const paragraph = document.createElement('p');
        paragraph.textContent = content;
        body.appendChild(paragraph);
      }

      if (photos && photos.length) {
        const media = document.createElement('div');
        media.className = 'message-media';
        media.innerHTML = photos.slice(0, 3)
          .map((url) => contentPhotoTag(url, 60, `${userName} upload`))
          .join('');
        body.appendChild(media);
      }

      const timeEl = document.createElement('time');
      if (createdAt) {
        timeEl.setAttribute('datetime', createdAt);
        timeEl.textContent = formatRelativeTimestamp(createdAt);
      } else {
        timeEl.textContent = '';
      }
      body.appendChild(timeEl);

      card.appendChild(body);
      container.appendChild(card);
    });

    attachImageFallbacks(container);
  }

  function bindMessageModule(root, pantry) {
    if (!root || !pantry || !pantry.id) return;
    const list = root.querySelector('[data-message-list]');
    const addBtn = root.querySelector('[data-message-add]');
    if (!list || !addBtn) return;

    messageState.root = list;
    messageState.pantryId = String(pantry.id);

    addBtn.onclick = async () => {
      const userNameInput = window.prompt('Your name (optional):') || 'Community member';
      const contentInput = window.prompt('Leave your message:');
      if (!contentInput || !contentInput.trim()) return;
      try {
        await window.PantryAPI.postMessage(
          String(pantry.id),
          contentInput.trim(),
          userNameInput.trim(),
          null,
          []
        );
        await loadMessages(pantry);
      } catch (error) {
        console.error('Error posting message:', error);
        window.alert('Failed to post message. Please try again.');
      }
    };

    loadMessages(pantry);
  }

  function openWishlistModal(pantry, onSuccess) {
    const overlay = document.createElement('div');
    overlay.className = 'wishlist-modal-overlay';
    overlay.innerHTML = `
      <div class="wishlist-modal" role="dialog" aria-modal="true">
        <button type="button" class="wishlist-modal-close" aria-label="Close">×</button>
        <h3>Add wishlist item</h3>
        <form class="wishlist-form">
          <label>
            <span>Item name</span>
            <input type="text" name="item" maxlength="80" required placeholder="e.g. Rice" />
          </label>
          <label>
            <span>Quantity</span>
            <input type="number" name="quantity" min="1" max="99" value="1" />
          </label>
          <p class="wishlist-modal-hint">Items stay visible for 7 days.</p>
          <div class="wishlist-modal-error" aria-live="polite"></div>
          <div class="wishlist-modal-actions">
            <button type="button" class="wishlist-modal-cancel">Cancel</button>
            <button type="submit" class="wishlist-modal-submit">Add item</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    const close = () => {
      document.body.classList.remove('modal-open');
      overlay.remove();
    };

    overlay.querySelector('.wishlist-modal-close').onclick = close;
    overlay.querySelector('.wishlist-modal-cancel').onclick = close;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    const form = overlay.querySelector('.wishlist-form');
    const submitBtn = overlay.querySelector('.wishlist-modal-submit');
    const errorEl = overlay.querySelector('.wishlist-modal-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const formData = new FormData(form);
      const item = String(formData.get('item') || '').trim();
      let quantity = parseInt(formData.get('quantity'), 10);
      if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1;
      if (!item) {
        errorEl.textContent = 'Please enter an item name.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding…';

      try {
        const updated = await window.PantryAPI.addWishlist(pantry.id, item, quantity);
        if (typeof onSuccess === 'function') await onSuccess(updated); // Re-fetch wishlist immediately after add
        close();
      } catch (error) {
        console.error('Error creating wishlist item:', error);
        errorEl.textContent = 'Failed to add item. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add item';
      }
    });
  }

  // Filter pantries by status
  function filterPantriesByStatus(status) {
    markers.forEach((marker, pantryId) => {
      // This would need to be implemented with actual pantry data
      // For now, just show all markers
      marker.setOpacity(1);
    });
  }

  // Update pantry marker (for real-time updates)
  function updatePantryMarker(pantry) {
    const marker = markers.get(pantry.id);
    if (marker) {
      // Update marker appearance if needed
      // This would be called when sensor data updates
    }
  }

  function setupCarousel(root) {
    const carousel = root.querySelector('[data-role="pantry-carousel"]');
    if (!carousel) return;
    const slides = Array.from(carousel.querySelectorAll('.slide'));
    const dots = Array.from(carousel.querySelectorAll('.dot'));
    if (slides.length <= 1) return;
    let index = 0;
    const update = () => {
      slides.forEach((s, i) => s.classList.toggle('active', i === index));
      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    };
    const prev = carousel.querySelector('.prev');
    const next = carousel.querySelector('.next');
    prev && prev.addEventListener('click', () => { index = (index - 1 + slides.length) % slides.length; update(); });
    next && next.addEventListener('click', () => { index = (index + 1) % slides.length; update(); });
    dots.forEach((d, i) => d.addEventListener('click', () => { index = i; update(); }));
    update();
  }

  // Expose functions globally for external updates
  window.PantryMap = {
    updatePantryMarker,
    showPantryDetails
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

