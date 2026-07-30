import { $, $$, randomColor } from '../utils.js';
import { api } from '../api.js';
import { openModal, closeModal, signalRefresh } from '../app.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:600">Categories</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" id="showIncomeCats"><i class="fas fa-arrow-down"></i> Income</button>
        <button class="btn btn-secondary btn-sm" id="showExpenseCats"><i class="fas fa-arrow-up"></i> Expense</button>
        <button class="btn btn-primary" id="addCategoryBtn"><i class="fas fa-plus"></i> Add Category</button>
      </div>
    </div>
    <div id="categoriesList"><div class="empty-state"><i class="fas fa-tags"></i><h3>Loading categories...</h3></div></div>
  `;

  let currentType = 'income';

  document.getElementById('showIncomeCats').addEventListener('click', () => { currentType = 'income'; loadCategories('income'); });
  document.getElementById('showExpenseCats').addEventListener('click', () => { currentType = 'expense'; loadCategories('expense'); });
  document.getElementById('addCategoryBtn').addEventListener('click', () => showCategoryForm(null, currentType));

  await loadCategories('income');
}

async function loadCategories(type) {
  try {
    const { categories, tree } = await api.getCategories({ type });
    const list = document.getElementById('categoriesList');

    if (categories.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-tags"></i><h3>No ${type} categories</h3><p>Create your first ${type} category</p></div>`;
      return;
    }

    function renderTree(nodes, depth = 0) {
      return nodes.map((cat) => `
        <div style="padding-left:${depth * 24}px;margin-bottom:8px">
          <div class="stats-card" style="padding:12px 16px;display:flex;align-items:center;gap:12px">
            <div class="card-icon" style="width:36px;height:36px;font-size:14px;background:${cat.color}22;color:${cat.color}"><i class="fas fa-${cat.icon || 'circle'}"></i></div>
            <div style="flex:1">
              <div style="font-weight:500;font-size:14px">${cat.name}</div>
              <div style="font-size:12px;color:var(--text-tertiary)">${cat.type}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn-icon btn-ghost edit-cat" data-id="${cat.id}" title="Edit"><i class="fas fa-edit"></i></button>
              <button class="btn-icon btn-ghost add-subcat" data-id="${cat.id}" title="Add Subcategory"><i class="fas fa-plus"></i></button>
              <button class="btn-icon btn-ghost delete-cat" data-id="${cat.id}" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>
        ${cat.children ? renderTree(cat.children, depth + 1) : ''}
      `).join('');
    }

    list.innerHTML = renderTree(tree);

    list.querySelectorAll('.edit-cat').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showCategoryForm(btn.dataset.id);
      });
    });

    list.querySelectorAll('.add-subcat').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showCategoryForm(null, type, btn.dataset.id);
      });
    });

    list.querySelectorAll('.delete-cat').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this category? Transactions will be uncategorized.')) {
          try {
            await api.deleteCategory(btn.dataset.id);
            signalRefresh();
            showToast('Category deleted', 'success');
            await loadCategories(type);
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

  } catch (err) {
    document.getElementById('categoriesList').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`;
  }
}

async function showCategoryForm(id = null, type = 'income', parentId = null) {
  let cat = { name: '', type, icon: 'circle', color: '#6366f1', sortOrder: 0 };

  if (id) {
    try {
      cat = await api.getCategory(id);
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  const icons = ['circle', 'utensils', 'car', 'shopping-bag', 'home', 'bolt', 'water', 'wifi', 'mobile-screen', 'cart-shopping', 'apple-whole', 'drumstick-bite', 'heart', 'stethoscope', 'baby', 'graduation-cap', 'bus', 'gas-pump', 'tshirt', 'film', 'mug-hot', 'plane', 'hotel', 'dumbbell', 'hand-holding-heart', 'people-group', 'sack-dollar', 'receipt', 'laptop', 'cloud', 'gears', 'gift', 'briefcase', 'building', 'laptop-code', 'youtube', 'facebook', 'gamepad', 'camera', 'music', 'book', 'paw', 'seedling', 'tools'];

  openModal({
    title: id ? 'Edit Category' : parentId ? 'Add Subcategory' : 'New Category',
    body: `
      <div class="form-group">
        <label class="form-label">Category Name</label>
        <input class="form-input" id="catName" value="${cat.name}" placeholder="Category name" />
      </div>
      ${!id && !parentId ? `
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="catType">
          <option value="income" ${type === 'income' ? 'selected' : ''}>Income</option>
          <option value="expense" ${type === 'expense' ? 'selected' : ''}>Expense</option>
          <option value="subcategory">Subcategory</option>
        </select>
      </div>` : ''}
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-picker" id="catColorPicker">
            ${['#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#14b8a6','#f97316','#06b6d4'].map((c) =>
              `<div class="color-swatch ${c === cat.color ? 'active' : ''}" style="background:${c}" data-color="${c}"></div>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div class="icon-picker" id="catIconPicker">
          ${icons.map((i) =>
            `<div class="icon-option ${i === cat.icon ? 'active' : ''}" data-icon="${i}"><i class="fas fa-${i}"></i></div>`
          ).join('')}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveCatBtn">${id ? 'Update' : 'Create'}</button>
    `,
  });

  let selectedColor = cat.color;
  let selectedIcon = cat.icon;

  document.querySelectorAll('#catColorPicker .color-swatch').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#catColorPicker .color-swatch').forEach((s) => s.classList.remove('active'));
      el.classList.add('active');
      selectedColor = el.dataset.color;
    });
  });

  document.querySelectorAll('#catIconPicker .icon-option').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#catIconPicker .icon-option').forEach((s) => s.classList.remove('active'));
      el.classList.add('active');
      selectedIcon = el.dataset.icon;
    });
  });

  document.getElementById('saveCatBtn').addEventListener('click', async () => {
    const name = document.getElementById('catName').value.trim();
    const catType = document.getElementById('catType') ? document.getElementById('catType').value : type;

    if (!name) {
      showToast('Category name is required', 'error');
      return;
    }

    const data = { name, type: catType, icon: selectedIcon, color: selectedColor };
    if (parentId) data.parentId = parentId;

    try {
      if (id) {
        await api.updateCategory(id, data);
        showToast('Category updated', 'success');
      } else {
        await api.createCategory(data);
        showToast('Category created', 'success');
      }
      signalRefresh();
      closeModal();
      await loadCategories(type);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

window.showCategoryForm = showCategoryForm;
