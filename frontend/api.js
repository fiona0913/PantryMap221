(function () {
  const API = {};

  function normalizePantryId(id) {
    if (id == null) return '';
    if (typeof id === 'number') {
      return Number.isFinite(id) ? String(id) : '';
    }
    const trimmed = String(id).trim();
    if (!trimmed) return '';
    if (/^\d+$/.test(trimmed)) {
      return String(Number.parseInt(trimmed, 10));
    }
    const prefixed = trimmed.match(/^(?:pantry|p)[-_]?(\d+)$/i);
    if (prefixed) {
      const parsed = Number.parseInt(prefixed[1], 10);
      return Number.isFinite(parsed) ? String(parsed) : '';
    }
    return trimmed;
  }

  function resolvePantryId(id) {
    const raw = id == null ? '' : String(id).trim();
    const normalized = normalizePantryId(raw);
    const backend = raw || normalized;
    const fallback = normalized || raw;
    return {
      raw,
      normalized,
      backend,
      fallback,
    };
  }

  function coerceNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function firstNumber(candidates) {
    for (const value of candidates) {
      const num = coerceNumber(value);
      if (num !== null) return num;
    }
    return null;
  }

  function extractLocation(p) {
    const lat = firstNumber([
      p.location?.lat,
      p.location?.latitude,
      p.lat,
      p.latitude,
      p.lat_or,
      p.latOr,
    ]);
    const lng = firstNumber([
      p.location?.lng,
      p.location?.lon,
      p.location?.longitude,
      p.lon,
      p.lng,
      p.longitude,
      p.lon_or,
      p.lonOr,
    ]);
    return {
      lat: lat ?? 0,
      lng: lng ?? 0,
    };
  }

  function extractAddress(p) {
    const base = String(p.address ?? p.adress ?? '').trim();
    const city = String(p.city ?? p.town ?? '').trim();
    const state = String(p.state ?? p.region ?? '').trim();
    const zip = String(p.zip ?? p.postalCode ?? p.zipcode ?? '').trim();

    const locality = [city, state].filter(Boolean).join(', ');
    const parts = [base];
    if (locality) parts.push(locality);
    if (zip) parts.push(zip);

    const filtered = parts.filter(Boolean);
    if (filtered.length) return filtered.join(', ');

    return '';
  }

  function extractPhotos(p) {
    if (Array.isArray(p.photos)) {
      return p.photos
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter((url) => /^https?:\/\//i.test(url));
    }

    if (typeof p.img_link === 'string' && p.img_link.trim()) {
      return p.img_link
        .split(/\s+/)
        .map((url) => url.trim())
        .filter((url) => /^https?:\/\//i.test(url));
    }

    return [];
  }

  function derivePantryType(p) {
    if (typeof p.pantryType === 'string' && p.pantryType.trim()) {
      return p.pantryType.trim().toLowerCase();
    }
    const detail = typeof p.detail === 'string' ? p.detail.trim() : '';
    if (!detail) return 'shelf';
    const lowered = detail.toLowerCase();
    if (lowered.includes('fridge') || lowered.includes('freezer')) return 'fridge';
    if (lowered.includes('shelf') || lowered.includes('cabinet')) return 'shelf';
    if (lowered.includes('pantry')) return 'shelf';
    return 'shelf';
  }

  function normalizePantry(p = {}) {
    const cosmosId = p.id != null ? String(p.id).trim() : '';
    const legacyId = p.pantryId != null ? String(p.pantryId).trim() : '';
    const { normalized: normalizedFallbackId } = resolvePantryId(cosmosId || legacyId || '');
    const id = cosmosId || legacyId || normalizedFallbackId || '';

    const rawStatus = typeof p.status === 'string' ? p.status.trim().toLowerCase() : '';
    const status = rawStatus === 'active' ? 'open' : rawStatus || 'open';

    const detail = typeof p.detail === 'string' ? p.detail.trim() : '';
    const description =
      detail ||
      (typeof p.description === 'string' ? p.description.trim() : '') ||
      (typeof p.network === 'string' ? p.network.trim() : '');

    return {
      id,
      name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Untitled Pantry',
      status,
      address: extractAddress(p),
      pantryType: derivePantryType(p),
      description,
      acceptedFoodTypes: Array.isArray(p.acceptedFoodTypes) ? p.acceptedFoodTypes : [],
      hours: p.hours ?? {},
      photos: extractPhotos(p),
      location: extractLocation(p),
      inventory: p.inventory ?? { categories: [] },
      sensors: p.sensors ?? {
        weightKg: 0,
        lastDoorEvent: '',
        updatedAt: new Date().toISOString(),
        foodCondition: '',
      },
      contact: p.contact ?? { owner: '', phone: '', manager: '', volunteer: '' },
      latestActivity: p.latestActivity ?? null,
      stats: p.stats ?? {
        visitsPerDay: 0,
        visitsPerWeek: 0,
        donationAvgPerDayKg: 0,
        donationAvgPerWeekKg: 0,
        popularTimes: [],
      },
      wishlist: Array.isArray(p.wishlist) ? p.wishlist : [],
      updatedAt: p.updatedAt ?? p.lastUpdated ?? p.modified ?? null,
    };
  }

  // API base URL - change to your backend URL
  const API_BASE_URL = 'http://localhost:7071/api';

  API.getPantries = async function getPantries(filters = {}) {
    try {
      console.log('Fetching pantries from backend API...');
      
      // Build query string from filters
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.bounds) params.append('bounds', filters.bounds);
      // Ensure we fetch enough pantries for the map (backend default is 100)
      params.append('page', String(filters.page ?? 1));
      params.append('pageSize', String(filters.pageSize ?? 500));
      
      const url = `${API_BASE_URL}/pantries${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      
      if (!res.ok) {
        const error = new Error(`Pantries request failed with status ${res.status}`);
        error.status = res.status;
        throw error;
      }

      const list = await res.json();
      const normalized = Array.isArray(list) ? list.map(normalizePantry) : [];
      console.info('[PantryAPI] Using backend pantries payload', normalized.length);
      return normalized;
    } catch (error) {
      const isNetworkError = error instanceof TypeError || error.name === 'TypeError';
      if (!isNetworkError) {
        console.error('[PantryAPI] Failed to load pantries from backend', error);
        throw error;
      }

      console.warn('[PantryAPI] Backend unreachable, falling back to static pantries.json');
      const res = await fetch('./pantries.json', { cache: 'no-store' });
      const list = await res.json();
      const normalized = Array.isArray(list) ? list.map(normalizePantry) : [];
      console.info('[PantryAPI] Using fallback pantries payload', normalized.length);
      return normalized;
    }
  };

  API.getPantry = async function getPantry(id) {
    const { backend: backendId, normalized: normalizedId } = resolvePantryId(id);
    if (!backendId) throw new Error('Pantry id is required');

    try {
      const res = await fetch(`${API_BASE_URL}/pantries/${encodeURIComponent(backendId)}`, { cache: 'no-store' });
      if (!res.ok) {
        const error = new Error(`Pantry request failed with status ${res.status}`);
        error.status = res.status;
        throw error;
      }
      const pantry = await res.json();
      console.info('[PantryAPI] Using backend pantry detail', backendId);
      return normalizePantry(pantry);
    } catch (error) {
      const isNetworkError = error instanceof TypeError || error.name === 'TypeError';
      if (!isNetworkError) {
        console.error('[PantryAPI] Failed to load pantry from backend', error);
        throw error;
      }

      console.warn('[PantryAPI] Backend unreachable when fetching pantry, using static fallback.');
      const res = await fetch('./pantries.json', { cache: 'no-store' });
      const list = await res.json();
      if (!Array.isArray(list)) {
        throw error;
      }

      const targetIds = new Set([backendId, normalizedId].filter(Boolean));
      const match = list.find((p) => {
        const candidate = resolvePantryId(p.id ?? p.pantryId);
        return [candidate.backend, candidate.normalized].some((value) => value && targetIds.has(value));
      });

      if (!match) {
        throw error;
      }

      return normalizePantry(match);
    }
  };

  API.getMessages = async function getMessages(pantryId) {
    const { backend: backendId } = resolvePantryId(pantryId);
    if (!backendId) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/messages?pantryId=${encodeURIComponent(backendId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  API.postMessage = async function postMessage(pantryId, content, userName, userAvatar, photos = []) {
    const { backend: backendId } = resolvePantryId(pantryId);
    if (!backendId) throw new Error('Pantry id is required');
    try {
      const res = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pantryId: backendId,
          content,
          userName,
          userAvatar,
          photos,
        }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error('Error posting message:', error);
      throw error;
    }
  };

  // Donations

  let donationsWarningLogged = false;

  API.getDonations = async function getDonations(pantryId, page = 1, pageSize = 5) {
    const { backend: backendId } = resolvePantryId(pantryId);
    if (!backendId) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/donations?pantryId=${encodeURIComponent(backendId)}&page=${page}&pageSize=${pageSize}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          if (!donationsWarningLogged) {
            console.info('[PantryAPI] /donations not yet implemented, returning []');
            donationsWarningLogged = true;
          }
          return [];
        }
        if (!donationsWarningLogged) {
          console.warn('[PantryAPI] /donations returned status', res.status);
          donationsWarningLogged = true;
        }
        return [];
      }
      const data = await res.json();
      return data.items || [];
    } catch (e) {
      const isNetworkError = e instanceof TypeError || e.name === 'TypeError';
      if (isNetworkError) {
        if (!donationsWarningLogged) {
          console.info('[PantryAPI] /donations unavailable (network/CORS). Returning [] for now.');
          donationsWarningLogged = true;
        }
        // TODO: Replace with real donations integration once /donations exists.
        return [];
      }
      if (!donationsWarningLogged) {
        console.warn('[PantryAPI] /donations errored, returning empty list.', e);
        donationsWarningLogged = true;
      }
      return [];
    }
  };

  API.addWishlistItem = async function addWishlistItem(pantryId, item, quantity = 1) {
    const { backend: backendId } = resolvePantryId(pantryId);
    const trimmedItem = typeof item === 'string' ? item.trim() : String(item || '').trim();
    const parsedQuantity = Number.parseInt(quantity, 10);
    const safeQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
    if (!backendId || !trimmedItem) throw new Error('Missing pantryId or item');

    const payload = {
      pantryId: backendId,
      item: trimmedItem,
      quantity: safeQuantity,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      return data?.agg ?? data;
    } catch (e) {
      console.error('Error adding wishlist item:', e);
      throw e;
    }
  };

  API.addWishlist = async function addWishlist(pantryId, item, quantity = 1) {
    await API.addWishlistItem(pantryId, item, quantity);
    return API.getWishlist(pantryId);
  };

  // Telemetry latest
  API.getTelemetryLatest = async function getTelemetryLatest(pantryId) {
    const { backend: backendId } = resolvePantryId(pantryId);
    if (!backendId) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/telemetry?pantryId=${encodeURIComponent(backendId)}&latest=true`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.latest || null;
    } catch (e) {
      console.error('Error fetching telemetry latest:', e);
      return null;
    }
  };

  // Telemetry history
  API.getTelemetryHistory = async function getTelemetryHistory(pantryId, from, to) {
    const { backend: backendId } = resolvePantryId(pantryId);
    if (!backendId) return [];
    try {
      let url = `${API_BASE_URL}/telemetry?pantryId=${encodeURIComponent(backendId)}`;
      if (from) url += `&from=${encodeURIComponent(from)}`;
      if (to) url += `&to=${encodeURIComponent(to)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.items || [];
    } catch (e) {
      console.error('Error fetching telemetry history:', e);
      return [];
    }
  };

  // Wishlist
  API.getWishlist = async function getWishlist(pantryId) {
    const { backend: backendId } = resolvePantryId(pantryId);
    if (!backendId) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/wishlist?pantryId=${encodeURIComponent(backendId)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error('Error fetching wishlist:', e);
      return [];
    }
  };

  // Expose globally
  window.PantryAPI = API;
})();


