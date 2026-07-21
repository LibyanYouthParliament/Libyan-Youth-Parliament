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

const RELATIONS_STORAGE_KEY = 'youth-parliament-relations-contacts';
const relationSeed = [
  { id: 1, name: 'رابطة الشباب الوطني', category: 'شبابية', owner: 'منسق الجهات الشبابية', date: '2026-07-25', status: 'قيد التواصل', note: 'إرسال الدعوة الرسمية ومتابعة تأكيد الحضور' },
  { id: 2, name: 'إدارة التوجيه المعنوي', category: 'عسكرية', owner: 'منسق الجهات العسكرية', date: '2026-07-23', status: 'تم التواصل', note: 'استلام قائمة المشاركين وتحديد نقطة الاتصال' },
  { id: 3, name: 'شبكة الإعلام الوطني', category: 'إعلامية', owner: 'منسق الإعلام', date: '2026-07-27', status: 'جديدة', note: 'مناقشة التغطية الإعلامية للملتقى' },
];

function loadRelations() {
  try {
    const saved = localStorage.getItem(RELATIONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : relationSeed;
  } catch {
    return relationSeed;
  }
}

let relations = loadRelations();
const relationsBody = document.querySelector('#relations-table-body');
const relationsSearch = document.querySelector('#relations-search');
const relationsFilter = document.querySelector('#relations-filter');

function persistRelations() {
  localStorage.setItem(RELATIONS_STORAGE_KEY, JSON.stringify(relations));
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
      <td>${formatRelationDate(item.date)}</td>
      <td><span class="status-chip ${relationStatusClass(item.status)}">${escapeHtml(item.status)}</span></td>
      <td><span class="row-actions"><button class="row-btn" type="button" data-action="advance" data-id="${item.id}" title="تحديث الحالة" aria-label="تحديث حالة ${escapeHtml(item.name)}">↻</button><button class="row-btn delete" type="button" data-action="delete" data-id="${item.id}" title="حذف" aria-label="حذف ${escapeHtml(item.name)}">×</button></span></td>
    </tr>`).join('');

  document.querySelector('#relations-empty').hidden = visible.length !== 0;
  document.querySelector('#relations-total').textContent = relations.length;
  document.querySelector('#relations-contacted').textContent = relations.filter((item) => ['تم التواصل', 'تأكيد الحضور'].includes(item.status)).length;
  document.querySelector('#relations-pending').textContent = relations.filter((item) => ['جديدة', 'قيد التواصل'].includes(item.status)).length;
  document.querySelector('#relations-count-label').textContent = `${visible.length} جهات مسجلة`;
}

document.querySelector('#relations-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  relations.unshift({ id: Date.now(), ...Object.fromEntries(formData.entries()) });
  persistRelations();
  renderRelations();
  event.currentTarget.reset();
  event.currentTarget.querySelector('.relations-form-status').textContent = 'تم حفظ جهة التواصل بنجاح.';
});

relationsSearch.addEventListener('input', renderRelations);
relationsFilter.addEventListener('change', renderRelations);
relationsBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = Number(button.dataset.id);
  if (button.dataset.action === 'delete') relations = relations.filter((item) => item.id !== id);
  if (button.dataset.action === 'advance') {
    const statuses = ['جديدة', 'قيد التواصل', 'تم التواصل', 'تأكيد الحضور'];
    relations = relations.map((item) => item.id === id ? { ...item, status: statuses[(statuses.indexOf(item.status) + 1) % statuses.length] } : item);
  }
  persistRelations();
  renderRelations();
});

renderRelations();
