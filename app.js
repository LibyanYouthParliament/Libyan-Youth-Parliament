const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const navLinks = [...document.querySelectorAll('.main-nav a')];

menuButton.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
});

navLinks.forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
}));

const sections = [...document.querySelectorAll('main section[id]')];
const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
}, { rootMargin: '-20% 0px -65%', threshold: [0, .2, .5] });
sections.forEach((section) => sectionObserver.observe(section));

const counters = document.querySelectorAll('[data-count]');
const counterObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const element = entry.target;
    const goal = Number(element.dataset.count);
    const suffix = element.dataset.suffix || '';
    const started = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - started) / 900, 1);
      element.textContent = `${Math.round(goal * (1 - Math.pow(1 - progress, 3)))}${suffix}`;
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    observer.unobserve(element);
  });
}, { threshold: .6 });
counters.forEach((counter) => counterObserver.observe(counter));

document.querySelector('#contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const status = event.currentTarget.querySelector('.form-status');
  const name = new FormData(event.currentTarget).get('name');
  status.textContent = `شكراً ${name}، تم استلام طلبك وستتواصل معك اللجنة قريباً.`;
  event.currentTarget.reset();
});

document.querySelector('#year').textContent = new Date().getFullYear();

const SUPABASE_URL = 'https://waglwnkcuhknuwbloudk.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_3RGh_i8X_KWAv2CwtV1djg_--0hWJVp';
const SESSION_STORAGE_KEY = 'youth-parliament-relations-session';

let relations = [];
let session = loadSession();
const relationsBody = document.querySelector('#relations-table-body');
const relationsSearch = document.querySelector('#relations-search');
const relationsFilter = document.querySelector('#relations-filter');
const relationsWorkspace = document.querySelector('#relations-workspace');
const relationsAuth = document.querySelector('#relations-auth');
const relationsSession = document.querySelector('#relations-session');
const authStatus = document.querySelector('#relations-auth-status');

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function saveSession(nextSession) {
  session = nextSession;
  if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_STORAGE_KEY);
}

async function refreshSession() {
  if (!session?.refresh_token) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLIC_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) {
    saveSession(null);
    return false;
  }
  saveSession(await response.json());
  return true;
}

async function supabaseRequest(path, options = {}, canRetry = true) {
  if (!session?.access_token) throw new Error('AUTH_REQUIRED');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (response.status === 401 && canRetry && await refreshSession()) {
    return supabaseRequest(path, options, false);
  }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.message || details.error_description || 'تعذر الاتصال بقاعدة البيانات.');
  }
  if (response.status === 204) return null;
  return response.json();
}

function setRelationsBusy(isBusy) {
  document.querySelector('.relations-form').classList.toggle('is-busy', isBusy);
  document.querySelector('.relations-register').classList.toggle('is-busy', isBusy);
}

function updateAuthUi() {
  const isSignedIn = Boolean(session?.access_token);
  relationsAuth.hidden = isSignedIn;
  relationsSession.hidden = !isSignedIn;
  relationsWorkspace.hidden = !isSignedIn;
  document.querySelector('#relations-user-email').textContent = session?.user?.email || '';
  if (!isSignedIn) {
    relations = [];
    renderRelations();
  }
}

function relationStatusClass(status) {
  if (status === 'تم التواصل') return 'done';
  if (status === 'تأكيد الحضور') return 'confirmed';
  if (status === 'قيد التواصل') return 'progress';
  return 'new';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function formatRelationDate(value) {
  if (!value) return 'غير محدد';
  return new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function renderRelations() {
  const query = relationsSearch.value.trim().toLowerCase();
  const filter = relationsFilter.value;
  const visible = relations.filter((item) => {
    const matchesQuery = `${item.name} ${item.owner} ${item.category}`.toLowerCase().includes(query);
    return matchesQuery && (filter === 'all' || item.status === filter);
  });

  relationsBody.innerHTML = visible.map((item) => `
    <tr>
      <td><span class="entity-cell"><strong>${escapeHtml(item.name)}</strong><small title="${escapeHtml(item.note)}">${escapeHtml(item.note)}</small></span></td>
      <td><span class="category-chip">${escapeHtml(item.category)}</span></td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${formatRelationDate(item.follow_up_date)}</td>
      <td><span class="status-chip ${relationStatusClass(item.status)}">${escapeHtml(item.status)}</span></td>
      <td><span class="row-actions"><button class="row-btn" type="button" data-action="advance" data-id="${item.id}" title="تحديث الحالة" aria-label="تحديث حالة ${escapeHtml(item.name)}">↻</button><button class="row-btn delete" type="button" data-action="delete" data-id="${item.id}" title="حذف" aria-label="حذف ${escapeHtml(item.name)}">×</button></span></td>
    </tr>`).join('');

  document.querySelector('#relations-empty').hidden = visible.length !== 0;
  document.querySelector('#relations-total').textContent = relations.length;
  document.querySelector('#relations-contacted').textContent = relations.filter((item) => ['تم التواصل', 'تأكيد الحضور'].includes(item.status)).length;
  document.querySelector('#relations-pending').textContent = relations.filter((item) => ['جديدة', 'قيد التواصل'].includes(item.status)).length;
  document.querySelector('#relations-count-label').textContent = `${visible.length} جهات مسجلة`;
}

async function fetchRelations() {
  if (!session?.access_token) return;
  setRelationsBusy(true);
  try {
    relations = await supabaseRequest('/rest/v1/relations_contacts?select=id,name,category,owner,follow_up_date,status,note,created_at&order=created_at.desc');
    renderRelations();
  } catch (error) {
    if (error.message === 'AUTH_REQUIRED' || !session) updateAuthUi();
    else document.querySelector('.relations-form-status').textContent = error.message;
  } finally {
    setRelationsBusy(false);
  }
}

document.querySelector('#relations-login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  authStatus.textContent = 'جارٍ تسجيل الدخول...';
  const fields = new FormData(event.currentTarget);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLIC_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fields.get('email'), password: fields.get('password') }),
  }).catch(() => null);
  if (!response?.ok) {
    authStatus.textContent = 'بيانات الدخول غير صحيحة أو تعذر الاتصال.';
    return;
  }
  saveSession(await response.json());
  authStatus.textContent = '';
  event.currentTarget.reset();
  updateAuthUi();
  await fetchRelations();
});

document.querySelector('#relations-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const status = event.currentTarget.querySelector('.relations-form-status');
  setRelationsBusy(true);
  try {
    await supabaseRequest('/rest/v1/relations_contacts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        name: formData.get('name'),
        category: formData.get('category'),
        owner: formData.get('owner'),
        follow_up_date: formData.get('date'),
        status: formData.get('status'),
        note: formData.get('note'),
      }),
    });
    event.currentTarget.reset();
    status.textContent = 'تم الحفظ في السجل المشترك.';
    await fetchRelations();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    setRelationsBusy(false);
  }
});

relationsSearch.addEventListener('input', renderRelations);
relationsFilter.addEventListener('change', renderRelations);
relationsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = Number(button.dataset.id);
  setRelationsBusy(true);
  try {
    if (button.dataset.action === 'delete') {
      await supabaseRequest(`/rest/v1/relations_contacts?id=eq.${id}`, { method: 'DELETE' });
    }
    if (button.dataset.action === 'advance') {
      const statuses = ['جديدة', 'قيد التواصل', 'تم التواصل', 'تأكيد الحضور'];
      const item = relations.find((entry) => entry.id === id);
      const nextStatus = statuses[(statuses.indexOf(item.status) + 1) % statuses.length];
      await supabaseRequest(`/rest/v1/relations_contacts?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: nextStatus, updated_at: new Date().toISOString() }),
      });
    }
    await fetchRelations();
  } catch (error) {
    document.querySelector('.relations-form-status').textContent = error.message;
  } finally {
    setRelationsBusy(false);
  }
});

document.querySelector('#relations-refresh').addEventListener('click', fetchRelations);
document.querySelector('#relations-logout').addEventListener('click', () => {
  saveSession(null);
  updateAuthUi();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && session) fetchRelations();
});

setInterval(() => {
  if (!document.hidden && session) fetchRelations();
}, 30000);

updateAuthUi();
if (session) fetchRelations();
