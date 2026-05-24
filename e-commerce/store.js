/* =====================================================
   STORE.JS — Logica condivisa per la piattaforma CSV
   ===================================================== */

// ── CONFIG ──────────────────────────────────────────
const CFG_KEY = 'storeConfig';
const CART_KEY = 'storeCart';

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || {};
  } catch { return {}; }
}

function saveConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

// ── CSV PARSER ───────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cols = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cols[i] || '').replace(/^"|"$/g, ''));
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

// ── CART ─────────────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(product, qty = 1) {
  const cart = getCart();
  const existing = cart.find(i => i.marca === product.marca && i.modello === product.modello);
  if (existing) { existing.qty = (existing.qty || 1) + qty; }
  else { cart.push({ ...product, qty }); }
  saveCart(cart);
  updateCartBadge();
}

function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  const count = getCart().reduce((s, i) => s + (i.qty || 1), 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ── PRICE UTILS ──────────────────────────────────────
function parsePrice(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
}

function formatPrice(num, currency = '€') {
  return currency + ' ' + num.toFixed(2).replace('.', ',');
}

// ── LOAD CSV FROM CONFIG ─────────────────────────────
async function loadProductsFromConfig() {
  const cfg = getConfig();
  if (!cfg.csvData) return [];
  return parseCSV(cfg.csvData);
}

// ── APPLY CUSTOM CSS ─────────────────────────────────
function applyCustomCSS() {
  const cfg = getConfig();
  if (!cfg.customCSS) return;
  const style = document.getElementById('custom-css') || document.createElement('style');
  style.id = 'custom-css';
  style.textContent = cfg.customCSS;
  document.head.appendChild(style);
}

// ── APPLY BRANDING ───────────────────────────────────
function applyBranding() {
  const cfg = getConfig();
  const nameEl = document.querySelectorAll('.store-name');
  nameEl.forEach(el => el.textContent = cfg.storeName || 'My Store');
  const tagEl = document.querySelectorAll('.store-tagline');
  tagEl.forEach(el => el.textContent = cfg.storeTagline || '');
  const logoEl = document.querySelectorAll('.store-logo');
  logoEl.forEach(el => { if (cfg.logoUrl) el.src = cfg.logoUrl; });
  if (cfg.accentColor) {
    document.documentElement.style.setProperty('--accent', cfg.accentColor);
  }
  if (cfg.bgColor) {
    document.documentElement.style.setProperty('--bg', cfg.bgColor);
  }
  if (cfg.fontFamily) {
    document.documentElement.style.setProperty('--font', cfg.fontFamily);
  }
  document.title = cfg.storeName || 'My Store';
}

// ── PDF GENERATION ───────────────────────────────────
function generateOrderPDF() {
  const cfg = getConfig();
  const cart = getCart();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const accent = cfg.accentColor || '#1a1a2e';
  const storeName = cfg.storeName || 'My Store';
  const currency = cfg.currency || '€';

  // Header block
  doc.setFillColor(accent.replace('#',''));
  doc.rect(0, 0, 210, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName, 15, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Riepilogo Ordine', 15, 28);
  const now = new Date();
  doc.text('Data: ' + now.toLocaleDateString('it-IT') + '  Ora: ' + now.toLocaleTimeString('it-IT'), 15, 34);

  // Order number
  const orderNum = 'ORD-' + Date.now().toString().slice(-8);
  doc.text('N° Ordine: ' + orderNum, 140, 28);

  doc.setTextColor(30, 30, 30);
  let y = 52;

  // Table header
  doc.setFillColor(240, 240, 245);
  doc.rect(10, y - 6, 190, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Prodotto', 12, y);
  doc.text('Modello', 75, y);
  doc.text('Qtà', 130, y);
  doc.text('Prezzo Unit.', 145, y);
  doc.text('Totale', 178, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  let grandTotal = 0;

  cart.forEach((item, idx) => {
    if (y > 260) { doc.addPage(); y = 20; }
    const price = parsePrice(item.prezzo);
    const qty = item.qty || 1;
    const rowTotal = price * qty;
    grandTotal += rowTotal;

    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 255);
      doc.rect(10, y - 5, 190, 9, 'F');
    }
    doc.setFontSize(9);
    doc.text(String(item.marca || ''), 12, y);
    doc.text(String(item.modello || '').substring(0, 25), 75, y);
    doc.text(String(qty), 133, y);
    doc.text(formatPrice(price, currency), 143, y);
    doc.text(formatPrice(rowTotal, currency), 176, y);
    y += 9;
  });

  // Separator
  y += 4;
  doc.setDrawColor(180, 180, 200);
  doc.line(10, y, 200, y);
  y += 8;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTALE ORDINE:', 130, y);
  doc.text(formatPrice(grandTotal, currency), 175, y);

  // Footer
  y = 275;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 140);
  doc.text('Grazie per il tuo acquisto! — ' + storeName, 105, y, { align: 'center' });
  if (cfg.storeEmail) doc.text('Contatti: ' + cfg.storeEmail, 105, y + 5, { align: 'center' });

  doc.save('ordine-' + orderNum + '.pdf');
}

// On every page load
document.addEventListener('DOMContentLoaded', () => {
  applyCustomCSS();
  applyBranding();
  updateCartBadge();
});
