(function () {
  "use strict";

  var STORAGE_KEY = "rpg-class-ideas-v1";
  var NODE_WIDTH = 152;
  var NODE_HEIGHT = 174;
  var NODE_CIRCLE = 128;
  var H_GAP = 124;
  var V_GAP = 58;
  var PADDING = 34;

  var ATTRIBUTES = {
    forca: { label: "For\u00e7a", className: "forca" },
    inteligencia: { label: "Intelig\u00eancia", className: "inteligencia" },
    destreza: { label: "Destreza", className: "destreza" }
  };

  var RARITIES = {
    inicial: { label: "Inicial" },
    comum: { label: "Comum" },
    incomum: { label: "Incomum" },
    rara: { label: "Rara" },
    unico: { label: "\u00danico" },
    lendaria: { label: "Lend\u00e1ria" }
  };

  var STAT_FIELDS = [
    { key: "forca", label: "For\u00e7a", short: "FOR" },
    { key: "inteligencia", label: "Intelig\u00eancia", short: "INT" },
    { key: "destreza", label: "Destreza", short: "DES" },
    { key: "vitalidade", label: "Vitalidade", short: "VIT" },
    { key: "mente", label: "Mente", short: "MEN" },
    { key: "estamina", label: "Estamina", short: "EST" }
  ];

  var state = {
    classes: loadClasses(),
    currentAttribute: readAttributeFromHash(),
    selectedId: null,
    formMode: null,
    photoDrag: null
  };

  var dom = {
    title: document.getElementById("viewTitle"),
    navItems: Array.prototype.slice.call(document.querySelectorAll(".nav-item")),
    countItems: Array.prototype.slice.call(document.querySelectorAll("[data-count]")),
    treeCanvas: document.getElementById("treeCanvas"),
    treeLines: document.getElementById("treeLines"),
    treeNodes: document.getElementById("treeNodes"),
    emptyState: document.getElementById("emptyState"),
    details: document.getElementById("detailsPanel"),
    quickAdd: document.getElementById("quickAddBtn"),
    newRoot: document.getElementById("newRootBtn"),
    newEvolution: document.getElementById("newEvolutionBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importFile: document.getElementById("importFile"),
    toast: document.getElementById("toast")
  };

  bindEvents();
  render();

  function bindEvents() {
    dom.navItems.forEach(function (button) {
      button.addEventListener("click", function () {
        var attribute = button.getAttribute("data-attribute");
        if (ATTRIBUTES[attribute]) {
          window.location.hash = attribute;
        }
      });
    });

    window.addEventListener("hashchange", function () {
      state.currentAttribute = readAttributeFromHash();
      state.selectedId = null;
      state.formMode = null;
      render();
    });

    dom.quickAdd.addEventListener("click", function () {
      openForm({ primary: state.currentAttribute });
    });

    dom.newRoot.addEventListener("click", function () {
      openForm({ primary: state.currentAttribute });
    });

    dom.newEvolution.addEventListener("click", function () {
      var selected = getSelectedClass();
      if (selected) {
        openForm({ primary: selected.primary, parentId: selected.id });
      }
    });

    dom.treeNodes.addEventListener("click", function (event) {
      var node = event.target.closest("[data-class-id]");
      if (!node) {
        return;
      }
      state.selectedId = node.getAttribute("data-class-id");
      state.formMode = null;
      render();
    });

    dom.emptyState.addEventListener("click", function (event) {
      if (event.target.matches("[data-action='new-root']")) {
        openForm({ primary: state.currentAttribute });
      }
    });

    dom.details.addEventListener("click", handleDetailsClick);
    dom.details.addEventListener("submit", handleFormSubmit);
    dom.details.addEventListener("pointerdown", handlePhotoPointerDown);
    window.addEventListener("pointermove", handlePhotoPointerMove);
    window.addEventListener("pointerup", endPhotoDrag);
    window.addEventListener("pointercancel", endPhotoDrag);
    dom.details.addEventListener("change", function (event) {
      if (event.target.matches("[name='primary']")) {
        refreshParentOptions(event.target.form);
        updatePhotoPreview(event.target.form);
      }
      if (event.target.matches("[data-photo-input]")) {
        handlePhotoFile(event.target);
      }
    });
    dom.details.addEventListener("input", function (event) {
      if (event.target.matches("[data-photo-scale]")) {
        applyPhotoVars(event.target.form);
      }
      if (event.target.matches("[name='name']")) {
        updatePhotoPreview(event.target.form);
      }
    });

    dom.exportBtn.addEventListener("click", exportData);
    dom.importFile.addEventListener("change", importData);
  }

  function readAttributeFromHash() {
    var raw = window.location.hash.replace("#", "");
    return ATTRIBUTES[raw] ? raw : "forca";
  }

  function loadClasses() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      var classes = Array.isArray(parsed) ? parsed : parsed.classes;
      if (!Array.isArray(classes)) {
        return [];
      }
      return classes.map(normalizeClass).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function normalizeClass(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    var primary = ATTRIBUTES[entry.primary] ? entry.primary : "forca";
    var rarity = RARITIES[entry.rarity] ? entry.rarity : "inicial";
    var stats = {};
    STAT_FIELDS.forEach(function (field) {
      var value = Number(entry.stats && entry.stats[field.key]);
      stats[field.key] = Number.isFinite(value) ? value : 0;
    });

    return {
      id: entry.id || makeId(),
      name: String(entry.name || "Classe sem nome").trim(),
      primary: primary,
      rarity: rarity,
      parentId: entry.parentId || "",
      lore: String(entry.lore || ""),
      photo: normalizePhoto(entry.photo),
      stats: stats,
      uniqueAttributes: Array.isArray(entry.uniqueAttributes)
        ? entry.uniqueAttributes.map(normalizeNamedValue).filter(Boolean)
        : [],
      activeSkills: Array.isArray(entry.activeSkills)
        ? entry.activeSkills.map(normalizePassive).filter(Boolean)
        : [],
      passives: Array.isArray(entry.passives)
        ? entry.passives.map(normalizePassive).filter(Boolean)
        : [],
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || new Date().toISOString()
    };
  }

  function normalizePhoto(entry) {
    var photo = entry && typeof entry === "object" ? entry : {};
    return {
      src: String(photo.src || ""),
      x: clampNumber(photo.x, -80, 80, 0),
      y: clampNumber(photo.y, -80, 80, 0),
      scale: clampNumber(photo.scale, 1, 3, 1)
    };
  }

  function normalizeNamedValue(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    var name = String(entry.name || "").trim();
    var value = String(entry.value || "").trim();
    if (!name && !value) {
      return null;
    }
    return {
      id: entry.id || makeId(),
      name: name,
      value: value
    };
  }

  function normalizePassive(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    var name = String(entry.name || "").trim();
    var description = String(entry.description || "").trim();
    if (!name && !description) {
      return null;
    }
    return {
      id: entry.id || makeId(),
      name: name,
      description: description
    };
  }

  function saveClasses() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.classes));
      return true;
    } catch (error) {
      showToast("N\u00e3o consegui salvar. A imagem pode estar muito pesada.");
      return false;
    }
  }

  function render() {
    var selected = getSelectedClass();
    if (selected && selected.primary !== state.currentAttribute) {
      state.selectedId = null;
      selected = null;
    }

    updateNav();
    renderTree();
    renderDetails();

    dom.newEvolution.disabled = !getSelectedClass();
  }

  function updateNav() {
    dom.title.textContent = ATTRIBUTES[state.currentAttribute].label;

    dom.navItems.forEach(function (button) {
      var attribute = button.getAttribute("data-attribute");
      button.classList.toggle("active", attribute === state.currentAttribute);
    });

    dom.countItems.forEach(function (item) {
      var attribute = item.getAttribute("data-count");
      item.textContent = state.classes.filter(function (entry) {
        return entry.primary === attribute;
      }).length;
    });
  }

  function renderTree() {
    var viewClasses = state.classes.filter(function (entry) {
      return entry.primary === state.currentAttribute;
    });

    dom.treeNodes.innerHTML = "";
    dom.treeLines.innerHTML = "";

    if (!viewClasses.length) {
      dom.emptyState.hidden = false;
      dom.treeCanvas.style.width = "";
      dom.treeCanvas.style.height = "";
      dom.treeLines.setAttribute("viewBox", "0 0 760 520");
      return;
    }

    dom.emptyState.hidden = true;

    var layout = computeLayout(viewClasses);
    dom.treeCanvas.style.width = layout.width + "px";
    dom.treeCanvas.style.height = layout.height + "px";
    dom.treeLines.setAttribute("width", String(layout.width));
    dom.treeLines.setAttribute("height", String(layout.height));
    dom.treeLines.setAttribute("viewBox", "0 0 " + layout.width + " " + layout.height);
    dom.treeLines.innerHTML = layout.paths.join("");
    dom.treeNodes.innerHTML = viewClasses.map(function (entry) {
      var position = layout.positions.get(entry.id);
      return renderNode(entry, position);
    }).join("");
  }

  function computeLayout(items) {
    var itemById = new Map(items.map(function (entry) {
      return [entry.id, entry];
    }));
    var childrenById = new Map();
    items.forEach(function (entry) {
      childrenById.set(entry.id, []);
    });
    items.forEach(function (entry) {
      if (entry.parentId && itemById.has(entry.parentId)) {
        childrenById.get(entry.parentId).push(entry);
      }
    });
    childrenById.forEach(function (children) {
      children.sort(compareByName);
    });

    var roots = items.filter(function (entry) {
      return !entry.parentId || !itemById.has(entry.parentId);
    }).sort(compareByName);

    var positions = new Map();
    var rowCursor = 0;
    var maxDepth = 0;

    roots.forEach(function (root) {
      walk(root, 0);
      rowCursor += 0.6;
    });

    function walk(entry, depth) {
      var children = childrenById.get(entry.id) || [];
      var row;
      maxDepth = Math.max(maxDepth, depth);

      if (children.length) {
        children.forEach(function (child) {
          walk(child, depth + 1);
        });
        var childRows = children.map(function (child) {
          return positions.get(child.id).row;
        });
        row = (Math.min.apply(null, childRows) + Math.max.apply(null, childRows)) / 2;
      } else {
        row = rowCursor;
        rowCursor += 1;
      }

      positions.set(entry.id, {
        row: row,
        x: PADDING + depth * (NODE_WIDTH + H_GAP),
        y: PADDING + row * (NODE_HEIGHT + V_GAP)
      });
    }

    var paths = [];
    items.forEach(function (entry) {
      if (!entry.parentId || !positions.has(entry.parentId) || !positions.has(entry.id)) {
        return;
      }
      var parent = positions.get(entry.parentId);
      var child = positions.get(entry.id);
      var circleOffset = (NODE_WIDTH - NODE_CIRCLE) / 2;
      var x1 = parent.x + circleOffset + NODE_CIRCLE;
      var y1 = parent.y + NODE_CIRCLE / 2;
      var x2 = child.x + circleOffset;
      var y2 = child.y + NODE_CIRCLE / 2;
      var mid = x1 + (x2 - x1) / 2;
      paths.push(
        '<path class="tree-line" d="M ' +
          x1 +
          " " +
          y1 +
          " C " +
          mid +
          " " +
          y1 +
          ", " +
          mid +
          " " +
          y2 +
          ", " +
          x2 +
          " " +
          y2 +
          '" />'
      );
    });

    var maxRow = 0;
    positions.forEach(function (position) {
      maxRow = Math.max(maxRow, position.row);
    });

    return {
      positions: positions,
      paths: paths,
      width: Math.max(760, PADDING * 2 + NODE_WIDTH + maxDepth * (NODE_WIDTH + H_GAP)),
      height: Math.max(520, PADDING * 2 + NODE_HEIGHT + maxRow * (NODE_HEIGHT + V_GAP))
    };
  }

  function renderNode(entry, position) {
    var parent = state.classes.find(function (candidate) {
      return candidate.id === entry.parentId;
    });
    var parentLabel = parent ? "Evolui de " + parent.name : "Classe inicial";

    return [
      '<button class="class-node ',
      entry.primary,
      " rarity-",
      entry.rarity,
      entry.id === state.selectedId ? " selected" : "",
      '" type="button" data-class-id="',
      escapeHtml(entry.id),
      '" title="',
      escapeHtml(entry.name + " - " + parentLabel + " - " + RARITIES[entry.rarity].label),
      '" style="left:',
      position.x,
      "px; top:",
      position.y,
      'px">',
      renderPortrait(entry, "node-portrait"),
      '<span class="node-title">',
      escapeHtml(entry.name),
      "</span>",
      "</button>"
    ].join("");
  }

  function renderDetails() {
    if (state.formMode) {
      dom.details.innerHTML = renderForm(state.formMode.entry, state.formMode.title);
      refreshParentOptions(dom.details.querySelector("form"));
      return;
    }

    var selected = getSelectedClass();
    if (!selected) {
      dom.details.innerHTML = [
        '<div class="panel-empty">',
        '<p class="panel-kicker">',
        escapeHtml(ATTRIBUTES[state.currentAttribute].label),
        "</p>",
        "<h2>Escolha uma classe</h2>",
        '<p class="muted-text">A classe selecionada aparece aqui com lore, atributos e passivas.</p>',
        '<button class="primary-action" type="button" data-action="new-root">Criar classe inicial</button>',
        "</div>"
      ].join("");
      return;
    }

    dom.details.innerHTML = renderClassDetails(selected);
  }

  function renderClassDetails(entry) {
    var parent = state.classes.find(function (candidate) {
      return candidate.id === entry.parentId;
    });
    var childrenCount = state.classes.filter(function (candidate) {
      return candidate.parentId === entry.id;
    }).length;

    return [
      '<div class="details-head">',
      '<div class="details-main">',
      renderPortrait(entry, "details-portrait"),
      "<div>",
      '<h2 class="details-title">',
      escapeHtml(entry.name),
      "</h2>",
      '<div class="tag-row">',
      '<span class="tag ',
      entry.primary,
      '">',
      escapeHtml(ATTRIBUTES[entry.primary].label),
      "</span>",
      '<span class="tag rarity-',
      entry.rarity,
      '">',
      escapeHtml(RARITIES[entry.rarity].label),
      "</span>",
      '<span class="tag">',
      escapeHtml(parent ? "Evolui de " + parent.name : "Classe inicial"),
      "</span>",
      childrenCount ? '<span class="tag">' + childrenCount + (childrenCount > 1 ? " evolu\u00e7\u00f5es" : " evolu\u00e7\u00e3o") + "</span>" : "",
      "</div>",
      "</div>",
      "</div>",
      '<div class="icon-actions">',
      '<button class="icon-button" type="button" title="Editar" data-action="edit">E</button>',
      '<button class="icon-button" type="button" title="Nova evolu\u00e7\u00e3o" data-action="new-child">+</button>',
      '<button class="icon-button danger-button" type="button" title="Excluir" data-action="delete">X</button>',
      "</div>",
      "</div>",
      '<section class="detail-section">',
      "<h3>Lore</h3>",
      '<p class="lore-text">',
      entry.lore ? escapeHtml(entry.lore) : '<span class="muted-text">Sem lore cadastrada.</span>',
      "</p>",
      "</section>",
      '<section class="detail-section">',
      "<h3>Atributos gerais</h3>",
      '<div class="stats-grid">',
      STAT_FIELDS.map(function (field) {
        return [
          '<div class="stat-pill"><span>',
          escapeHtml(field.label),
          "</span><strong>",
          safeNumber(entry.stats[field.key]),
          "</strong></div>"
        ].join("");
      }).join(""),
      "</div>",
      "</section>",
      '<section class="detail-section">',
      "<h3>Atributos \u00fanicos</h3>",
      renderNamedValueList(entry.uniqueAttributes, "Nenhum atributo \u00fanico cadastrado."),
      "</section>",
      '<section class="detail-section">',
      "<h3>Habilidades ativas</h3>",
      renderActiveSkillList(entry.activeSkills),
      "</section>",
      '<section class="detail-section">',
      "<h3>Passivas</h3>",
      renderPassiveList(entry.passives),
      "</section>"
    ].join("");
  }

  function renderNamedValueList(items, emptyText) {
    if (!items.length) {
      return '<p class="muted-text">' + escapeHtml(emptyText) + "</p>";
    }
    return [
      '<div class="list-stack">',
      items.map(function (item) {
        return [
          '<div class="info-row"><strong>',
          escapeHtml(item.name || "Atributo"),
          "</strong><span>",
          escapeHtml(item.value || "-"),
          "</span></div>"
        ].join("");
      }).join(""),
      "</div>"
    ].join("");
  }

  function renderPassiveList(items) {
    if (!items.length) {
      return '<p class="muted-text">Nenhuma passiva cadastrada.</p>';
    }
    return [
      '<div class="list-stack">',
      items.map(function (item) {
        return [
          '<div class="info-row"><strong>',
          escapeHtml(item.name || "Passiva"),
          "</strong><span>",
          escapeHtml(item.description || "-"),
          "</span></div>"
        ].join("");
      }).join(""),
      "</div>"
    ].join("");
  }

  function renderActiveSkillList(items) {
    if (!items.length) {
      return '<p class="muted-text">Nenhuma habilidade ativa cadastrada.</p>';
    }
    return [
      '<div class="list-stack">',
      items.map(function (item) {
        return [
          '<div class="info-row"><strong>',
          escapeHtml(item.name || "Habilidade"),
          "</strong><span>",
          escapeHtml(item.description || "-"),
          "</span></div>"
        ].join("");
      }).join(""),
      "</div>"
    ].join("");
  }

  function renderPortrait(entry, className) {
    var photo = normalizePhoto(entry.photo);
    return [
      '<span class="portrait-viewport ',
      className || "",
      " ",
      entry.primary || "",
      photo.src ? " has-photo" : "",
      '">',
      renderPortraitInner(photo, entry.name),
      "</span>"
    ].join("");
  }

  function renderPortraitInner(photo, name) {
    var normalized = normalizePhoto(photo);
    if (normalized.src) {
      return [
        '<img class="portrait-image" src="',
        escapeHtml(normalized.src),
        '" alt="" style="',
        renderPhotoVars(normalized),
        '">'
      ].join("");
    }

    return [
      '<span class="portrait-placeholder">',
      escapeHtml(getInitials(name)),
      "</span>"
    ].join("");
  }

  function renderPhotoVars(photo) {
    var normalized = normalizePhoto(photo);
    return [
      "--photo-x:",
      normalized.x,
      "%; --photo-y:",
      normalized.y,
      "%; --photo-scale:",
      normalized.scale,
      ";"
    ].join("");
  }

  function renderForm(entry, title) {
    var isEdit = Boolean(entry.id);
    var stats = entry.stats || {};
    var photo = normalizePhoto(entry.photo);

    return [
      '<form class="class-form" id="classForm">',
      '<input type="hidden" name="id" value="',
      escapeHtml(entry.id || ""),
      '">',
      '<input type="hidden" name="photoSrc" value="',
      escapeHtml(photo.src),
      '">',
      '<input type="hidden" name="photoX" value="',
      photo.x,
      '">',
      '<input type="hidden" name="photoY" value="',
      photo.y,
      '">',
      '<h2 class="form-title">',
      escapeHtml(title),
      "</h2>",
      '<div class="form-section photo-section">',
      '<div class="form-section-head"><h3>Foto</h3></div>',
      '<div class="photo-editor">',
      '<div class="photo-editor-frame portrait-viewport ',
      entry.primary,
      photo.src ? " has-photo" : "",
      '" data-photo-frame title="Arraste para posicionar">',
      renderPortraitInner(photo, entry.name),
      "</div>",
      '<div class="photo-controls">',
      '<label class="secondary-action file-action">Adicionar foto',
      '<input type="file" accept="image/*" data-photo-input>',
      "</label>",
      '<button class="mini-action" type="button" data-action="remove-photo">Remover foto</button>',
      '<label class="field">Zoom',
      '<input type="range" name="photoScale" data-photo-scale min="1" max="3" step="0.05" value="',
      photo.scale,
      '">',
      "</label>",
      "</div>",
      "</div>",
      "</div>",
      '<label class="field">Nome',
      '<input name="name" required maxlength="80" value="',
      escapeHtml(entry.name || ""),
      '" autocomplete="off">',
      "</label>",
      '<div class="field-grid">',
      '<label class="field">Atributo prim\u00e1rio',
      '<select name="primary">',
      Object.keys(ATTRIBUTES).map(function (key) {
        return '<option value="' + key + '"' + (key === entry.primary ? " selected" : "") + ">" + escapeHtml(ATTRIBUTES[key].label) + "</option>";
      }).join(""),
      "</select>",
      "</label>",
      '<label class="field">Raridade',
      '<select name="rarity">',
      Object.keys(RARITIES).map(function (key) {
        return '<option value="' + key + '"' + (key === entry.rarity ? " selected" : "") + ">" + escapeHtml(RARITIES[key].label) + "</option>";
      }).join(""),
      "</select>",
      "</label>",
      '<label class="field">Evolui de',
      '<select name="parentId" data-current-parent="',
      escapeHtml(entry.parentId || ""),
      '"></select>',
      "</label>",
      "</div>",
      '<label class="field">Lore',
      '<textarea name="lore">',
      escapeHtml(entry.lore || ""),
      "</textarea>",
      "</label>",
      '<div class="form-section">',
      '<div class="form-section-head"><h3>Atributos gerais</h3></div>',
      '<div class="field-grid">',
      STAT_FIELDS.map(function (field) {
        return [
          '<label class="field">',
          escapeHtml(field.label),
          '<input type="number" name="stat_',
          field.key,
          '" value="',
          safeNumber(stats[field.key]),
          '" step="1">',
          "</label>"
        ].join("");
      }).join(""),
      "</div>",
      "</div>",
      '<div class="form-section">',
      '<div class="form-section-head">',
      "<h3>Atributos \u00fanicos</h3>",
      '<button class="mini-action" type="button" data-action="add-unique">Adicionar</button>',
      "</div>",
      '<div class="dynamic-list" id="uniqueList">',
      renderUniqueRows(entry.uniqueAttributes || []),
      "</div>",
      "</div>",
      '<div class="form-section">',
      '<div class="form-section-head">',
      "<h3>Habilidades ativas</h3>",
      '<button class="mini-action" type="button" data-action="add-active-skill">Adicionar</button>',
      "</div>",
      '<div class="dynamic-list" id="activeSkillList">',
      renderActiveSkillRows(entry.activeSkills || []),
      "</div>",
      "</div>",
      '<div class="form-section">',
      '<div class="form-section-head">',
      "<h3>Passivas</h3>",
      '<button class="mini-action" type="button" data-action="add-passive">Adicionar</button>',
      "</div>",
      '<div class="dynamic-list" id="passiveList">',
      renderPassiveRows(entry.passives || []),
      "</div>",
      "</div>",
      '<div class="form-actions">',
      '<button class="secondary-action" type="button" data-action="cancel">Cancelar</button>',
      '<button class="primary-action" type="submit">',
      isEdit ? "Salvar" : "Criar",
      "</button>",
      "</div>",
      "</form>"
    ].join("");
  }

  function renderUniqueRows(items) {
    if (!items.length) {
      return renderUniqueRow({});
    }
    return items.map(renderUniqueRow).join("");
  }

  function renderUniqueRow(item) {
    return [
      '<div class="dynamic-row" data-unique-row>',
      '<input data-unique-name placeholder="Nome" value="',
      escapeHtml(item.name || ""),
      '">',
      '<input data-unique-value placeholder="Valor ou descri\u00e7\u00e3o" value="',
      escapeHtml(item.value || ""),
      '">',
      '<button class="icon-button danger-button" type="button" title="Remover" data-action="remove-row">X</button>',
      "</div>"
    ].join("");
  }

  function renderPassiveRows(items) {
    if (!items.length) {
      return renderPassiveRow({});
    }
    return items.map(renderPassiveRow).join("");
  }

  function renderPassiveRow(item) {
    return [
      '<div class="dynamic-row passive-row" data-passive-row>',
      "<div>",
      '<input data-passive-name placeholder="Nome da passiva" value="',
      escapeHtml(item.name || ""),
      '">',
      '<textarea data-passive-description placeholder="Descri\u00e7\u00e3o">',
      escapeHtml(item.description || ""),
      "</textarea>",
      "</div>",
      '<button class="icon-button danger-button" type="button" title="Remover" data-action="remove-row">X</button>',
      "</div>"
    ].join("");
  }

  function renderActiveSkillRows(items) {
    if (!items.length) {
      return renderActiveSkillRow({});
    }
    return items.map(renderActiveSkillRow).join("");
  }

  function renderActiveSkillRow(item) {
    return [
      '<div class="dynamic-row passive-row" data-active-skill-row>',
      "<div>",
      '<input data-active-skill-name placeholder="Nome da habilidade" value="',
      escapeHtml(item.name || ""),
      '">',
      '<textarea data-active-skill-description placeholder="Descri\u00e7\u00e3o">',
      escapeHtml(item.description || ""),
      "</textarea>",
      "</div>",
      '<button class="icon-button danger-button" type="button" title="Remover" data-action="remove-row">X</button>',
      "</div>"
    ].join("");
  }

  function refreshParentOptions(form) {
    if (!form) {
      return;
    }
    var select = form.elements.parentId;
    var primary = form.elements.primary.value;
    var currentParent = select.value || select.getAttribute("data-current-parent") || "";
    var editingId = form.elements.id.value;
    var descendants = editingId ? getDescendantIds(editingId) : new Set();
    var options = state.classes
      .filter(function (entry) {
        return entry.primary === primary && entry.id !== editingId && !descendants.has(entry.id);
      })
      .sort(compareByName);

    select.innerHTML = '<option value="">Classe inicial</option>' + options.map(function (entry) {
      return '<option value="' + escapeHtml(entry.id) + '">' + escapeHtml(entry.name) + "</option>";
    }).join("");

    if (options.some(function (entry) { return entry.id === currentParent; })) {
      select.value = currentParent;
    } else {
      select.value = "";
    }
    select.setAttribute("data-current-parent", select.value);
  }

  function handleDetailsClick(event) {
    var actionElement = event.target.closest("[data-action]");
    if (!actionElement) {
      return;
    }
    var action = actionElement.getAttribute("data-action");
    var selected = getSelectedClass();

    if (action === "new-root") {
      openForm({ primary: state.currentAttribute });
      return;
    }

    if (action === "new-child" && selected) {
      openForm({ primary: selected.primary, parentId: selected.id });
      return;
    }

    if (action === "edit" && selected) {
      openForm(cloneClass(selected), "Editar classe");
      return;
    }

    if (action === "delete" && selected) {
      deleteClass(selected);
      return;
    }

    if (action === "cancel") {
      state.formMode = null;
      render();
      return;
    }

    if (action === "add-unique") {
      document.getElementById("uniqueList").insertAdjacentHTML("beforeend", renderUniqueRow({}));
      return;
    }

    if (action === "add-passive") {
      document.getElementById("passiveList").insertAdjacentHTML("beforeend", renderPassiveRow({}));
      return;
    }

    if (action === "add-active-skill") {
      document.getElementById("activeSkillList").insertAdjacentHTML("beforeend", renderActiveSkillRow({}));
      return;
    }

    if (action === "remove-photo") {
      clearPhoto(actionElement.form);
      return;
    }

    if (action === "remove-row") {
      var row = actionElement.closest(".dynamic-row");
      if (row) {
        row.remove();
      }
    }
  }

  function handlePhotoFile(input) {
    var file = input.files && input.files[0];
    if (!file) {
      return;
    }
    if (!/^image\//.test(file.type)) {
      showToast("Escolha um arquivo de imagem.");
      input.value = "";
      return;
    }

    readImageFile(file, function (dataUrl) {
      var form = input.form;
      if (!form) {
        return;
      }
      form.elements.photoSrc.value = dataUrl;
      form.elements.photoX.value = "0";
      form.elements.photoY.value = "0";
      form.elements.photoScale.value = "1";
      updatePhotoPreview(form);
      input.value = "";
    });
  }

  function readImageFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result || "");
      var image = new Image();
      image.onload = function () {
        var maxSize = 900;
        var ratio = Math.min(1, maxSize / image.width, maxSize / image.height);
        if (ratio === 1 && file.size < 900000) {
          callback(dataUrl);
          return;
        }

        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        try {
          var context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          callback(canvas.toDataURL("image/jpeg", 0.86));
        } catch (error) {
          callback(dataUrl);
        }
      };
      image.onerror = function () {
        callback(dataUrl);
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function handlePhotoPointerDown(event) {
    var frame = event.target.closest("[data-photo-frame]");
    if (!frame || !frame.classList.contains("has-photo")) {
      return;
    }

    var form = frame.closest("form");
    if (!form || !form.elements.photoSrc.value) {
      return;
    }

    var photo = readPhotoForm(form);
    state.photoDrag = {
      form: form,
      frame: frame,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: photo.x,
      startY: photo.y
    };
    frame.classList.add("is-dragging");
    frame.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePhotoPointerMove(event) {
    var drag = state.photoDrag;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    var rect = drag.frame.getBoundingClientRect();
    var nextX = drag.startX + ((event.clientX - drag.startClientX) / rect.width) * 100;
    var nextY = drag.startY + ((event.clientY - drag.startClientY) / rect.height) * 100;
    drag.form.elements.photoX.value = String(clampNumber(nextX, -80, 80, 0));
    drag.form.elements.photoY.value = String(clampNumber(nextY, -80, 80, 0));
    applyPhotoVars(drag.form);
  }

  function endPhotoDrag(event) {
    var drag = state.photoDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    drag.frame.classList.remove("is-dragging");
    if (drag.frame.hasPointerCapture && drag.frame.hasPointerCapture(event.pointerId)) {
      drag.frame.releasePointerCapture(event.pointerId);
    }
    state.photoDrag = null;
  }

  function clearPhoto(form) {
    if (!form) {
      return;
    }
    form.elements.photoSrc.value = "";
    form.elements.photoX.value = "0";
    form.elements.photoY.value = "0";
    form.elements.photoScale.value = "1";
    updatePhotoPreview(form);
  }

  function updatePhotoPreview(form) {
    if (!form) {
      return;
    }
    var frame = form.querySelector("[data-photo-frame]");
    if (!frame) {
      return;
    }

    var photo = readPhotoForm(form);
    var primary = form.elements.primary.value;
    frame.classList.toggle("forca", primary === "forca");
    frame.classList.toggle("inteligencia", primary === "inteligencia");
    frame.classList.toggle("destreza", primary === "destreza");
    frame.classList.toggle("has-photo", Boolean(photo.src));
    frame.innerHTML = renderPortraitInner(photo, form.elements.name.value);
    applyPhotoVars(form);
  }

  function applyPhotoVars(form) {
    if (!form) {
      return;
    }
    var image = form.querySelector("[data-photo-frame] .portrait-image");
    if (image) {
      image.setAttribute("style", renderPhotoVars(readPhotoForm(form)));
    }
  }

  function handleFormSubmit(event) {
    if (!event.target.matches("#classForm")) {
      return;
    }

    event.preventDefault();
    var form = event.target;
    var data = readForm(form);
    if (!data.name) {
      showToast("Informe o nome da classe.");
      return;
    }

    if (data.id && data.parentId && (data.parentId === data.id || getDescendantIds(data.id).has(data.parentId))) {
      showToast("A classe n\u00e3o pode evoluir de uma evolu\u00e7\u00e3o dela.");
      return;
    }

    var existingIndex = state.classes.findIndex(function (entry) {
      return entry.id === data.id;
    });

    if (existingIndex >= 0) {
      data.createdAt = state.classes[existingIndex].createdAt;
      data.updatedAt = new Date().toISOString();
      state.classes.splice(existingIndex, 1, data);
    } else {
      data.id = makeId();
      data.createdAt = new Date().toISOString();
      data.updatedAt = data.createdAt;
      state.classes.push(data);
      state.selectedId = data.id;
    }

    state.currentAttribute = data.primary;
    window.location.hash = data.primary;
    state.selectedId = data.id;
    state.formMode = null;
    if (!saveClasses()) {
      render();
      return;
    }
    render();
    showToast("Classe salva.");
  }

  function readForm(form) {
    var stats = {};
    STAT_FIELDS.forEach(function (field) {
      var value = Number(form.elements["stat_" + field.key].value);
      stats[field.key] = Number.isFinite(value) ? value : 0;
    });

    return {
      id: form.elements.id.value,
      name: form.elements.name.value.trim(),
      primary: form.elements.primary.value,
      rarity: form.elements.rarity.value,
      parentId: form.elements.parentId.value,
      lore: form.elements.lore.value.trim(),
      photo: readPhotoForm(form),
      stats: stats,
      uniqueAttributes: readUniqueRows(form),
      activeSkills: readActiveSkillRows(form),
      passives: readPassiveRows(form)
    };
  }

  function readPhotoForm(form) {
    return normalizePhoto({
      src: form.elements.photoSrc ? form.elements.photoSrc.value : "",
      x: form.elements.photoX ? Number(form.elements.photoX.value) : 0,
      y: form.elements.photoY ? Number(form.elements.photoY.value) : 0,
      scale: form.elements.photoScale ? Number(form.elements.photoScale.value) : 1
    });
  }

  function readUniqueRows(form) {
    return Array.prototype.slice.call(form.querySelectorAll("[data-unique-row]")).map(function (row) {
      return normalizeNamedValue({
        name: row.querySelector("[data-unique-name]").value,
        value: row.querySelector("[data-unique-value]").value
      });
    }).filter(Boolean);
  }

  function readPassiveRows(form) {
    return Array.prototype.slice.call(form.querySelectorAll("[data-passive-row]")).map(function (row) {
      return normalizePassive({
        name: row.querySelector("[data-passive-name]").value,
        description: row.querySelector("[data-passive-description]").value
      });
    }).filter(Boolean);
  }

  function readActiveSkillRows(form) {
    return Array.prototype.slice.call(form.querySelectorAll("[data-active-skill-row]")).map(function (row) {
      return normalizePassive({
        name: row.querySelector("[data-active-skill-name]").value,
        description: row.querySelector("[data-active-skill-description]").value
      });
    }).filter(Boolean);
  }

  function openForm(partial, title) {
    var draft = Object.assign({
      id: "",
      name: "",
      primary: state.currentAttribute,
      rarity: "inicial",
      parentId: "",
      lore: "",
      photo: {},
      stats: {},
      uniqueAttributes: [],
      activeSkills: [],
      passives: []
    }, partial || {});
    var entry = normalizeClass(draft);

    entry.id = draft.id || "";
    entry.name = draft.name || "";
    state.formMode = {
      title: title || (entry.parentId ? "Nova evolu\u00e7\u00e3o" : "Nova classe"),
      entry: entry
    };
    render();
  }

  function deleteClass(entry) {
    var children = state.classes.filter(function (candidate) {
      return candidate.parentId === entry.id;
    });
    var message = children.length
      ? "Excluir esta classe? As evolu\u00e7\u00f5es diretas v\u00e3o virar classes iniciais."
      : "Excluir esta classe?";

    if (!window.confirm(message)) {
      return;
    }

    state.classes = state.classes.filter(function (candidate) {
      return candidate.id !== entry.id;
    }).map(function (candidate) {
      if (candidate.parentId === entry.id) {
        return Object.assign({}, candidate, { parentId: "" });
      }
      return candidate;
    });
    state.selectedId = null;
    state.formMode = null;
    if (!saveClasses()) {
      render();
      return;
    }
    render();
    showToast("Classe exclu\u00edda.");
  }

  function getSelectedClass() {
    if (!state.selectedId) {
      return null;
    }
    return state.classes.find(function (entry) {
      return entry.id === state.selectedId;
    }) || null;
  }

  function getDescendantIds(id) {
    var descendants = new Set();
    var queue = [id];

    while (queue.length) {
      var current = queue.shift();
      state.classes.forEach(function (entry) {
        if (entry.parentId === current && !descendants.has(entry.id)) {
          descendants.add(entry.id);
          queue.push(entry.id);
        }
      });
    }

    return descendants;
  }

  function exportData() {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      classes: state.classes
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rpg-classes-backup.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exportado.");
  }

  function importData(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        var classes = Array.isArray(parsed) ? parsed : parsed.classes;
        if (!Array.isArray(classes)) {
          throw new Error("Formato inv\u00e1lido");
        }
        if (!window.confirm("Importar este arquivo vai substituir as classes atuais.")) {
          return;
        }
        state.classes = classes.map(normalizeClass).filter(Boolean);
        state.selectedId = null;
        state.formMode = null;
        if (!saveClasses()) {
          render();
          return;
        }
        render();
        showToast("Arquivo importado.");
      } catch (error) {
        showToast("N\u00e3o consegui importar esse JSON.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function cloneClass(entry) {
    return JSON.parse(JSON.stringify(entry));
  }

  function compareByName(a, b) {
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  }

  function getInitials(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) {
      return "?";
    }

    return parts.slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("");
  }

  function safeNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function clampNumber(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(function () {
      dom.toast.classList.remove("show");
    }, 2200);
  }
})();
