const CONFIG_PATH = "/data/local/tmp/re.zyg.fri/config.json";
const DEFAULT_MAIN_LIBRARY = "/data/local/tmp/re.zyg.fri/libgadget.so";
const DEFAULT_CHILD_LIBRARY = "/data/local/tmp/re.zyg.fri/libgadget-child.so";

const elements = {
  targets: document.querySelector("#targets"),
  emptyState: document.querySelector("#empty-state"),
  notice: document.querySelector("#notice"),
  addTarget: document.querySelector("#add-target"),
  emptyAddTarget: document.querySelector("#empty-add-target"),
  saveConfig: document.querySelector("#save-config"),
  targetTemplate: document.querySelector("#target-template"),
  libraryTemplate: document.querySelector("#library-template"),
  packageDialog: document.querySelector("#package-dialog"),
  packageSearch: document.querySelector("#package-search"),
  packageList: document.querySelector("#package-list"),
};

let config = { targets: [] };
let initialSnapshot = "";
let loadFailed = false;
let packageChoices = [];
let packageTargetIndex = null;

function isFileBridge(value) {
  return value != null && typeof value.read === "function" && typeof value.write === "function";
}

function findFileBridge() {
  const preferredNames = ["$zyFile", "$ZyFile", "$zygiskfridaFile", "$ZygiskFridaFile"];
  for (const name of preferredNames) {
    if (isFileBridge(window[name])) return window[name];
  }

  for (const name of Object.getOwnPropertyNames(window)) {
    if (name.startsWith("$") && name.endsWith("File") && isFileBridge(window[name])) {
      return window[name];
    }
  }

  return null;
}

function normalizeLibrary(library) {
  return { path: typeof library?.path === "string" ? library.path : "" };
}

function normalizeTarget(target) {
  const childGating = target?.child_gating;
  return {
    app_name: typeof target?.app_name === "string" ? target.app_name : "",
    enabled: target?.enabled !== false,
    start_up_delay_ms: Number.isSafeInteger(target?.start_up_delay_ms)
      ? Math.max(0, target.start_up_delay_ms)
      : 0,
    injected_libraries: Array.isArray(target?.injected_libraries)
      ? target.injected_libraries.map(normalizeLibrary)
      : [{ path: DEFAULT_MAIN_LIBRARY }],
    child_gating: {
      enabled: childGating?.enabled === true,
      mode: ["freeze", "kill", "inject"].includes(childGating?.mode)
        ? childGating.mode
        : "freeze",
      injected_libraries: Array.isArray(childGating?.injected_libraries)
        ? childGating.injected_libraries.map(normalizeLibrary)
        : [{ path: DEFAULT_CHILD_LIBRARY }],
    },
  };
}

function loadConfig() {
  const fileBridge = findFileBridge();
  if (!fileBridge) {
    loadFailed = true;
    showNotice("error", "WebUI X file access is unavailable. Open this page from a supported root manager or WebUI X host.");
    return;
  }

  const text = fileBridge.read(CONFIG_PATH);
  if (text == null || text.trim() === "") {
    config = { targets: [] };
    initialSnapshot = JSON.stringify(config);
    showNotice("info", "No config.json exists yet. Add a target and save to create it.");
    return;
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.targets)) {
      throw new Error("the root object must contain a targets array");
    }
    config = { targets: parsed.targets.map(normalizeTarget) };
    initialSnapshot = JSON.stringify(config);
  } catch (error) {
    loadFailed = true;
    showNotice("error", `The existing config is invalid, so saving is disabled: ${error.message}`);
  }
}

function newTarget() {
  return normalizeTarget({
    app_name: "",
    enabled: true,
    start_up_delay_ms: 0,
    injected_libraries: [{ path: DEFAULT_MAIN_LIBRARY }],
  });
}

function showNotice(kind, message) {
  elements.notice.hidden = false;
  elements.notice.className = `notice ${kind}`;
  elements.notice.textContent = message;
}

function hideNotice() {
  elements.notice.hidden = true;
}

function updateDirtyState() {
  const dirty = JSON.stringify(config) !== initialSnapshot;
  elements.saveConfig.textContent = dirty ? "Save changes •" : "Save changes";
  elements.saveConfig.disabled = loadFailed;
}

function addLibraryRow(container, library, onChange, onRemove) {
  const row = elements.libraryTemplate.content.firstElementChild.cloneNode(true);
  const input = row.querySelector(".library-path");
  input.value = library.path;
  input.addEventListener("input", () => {
    onChange(input.value);
    updateDirtyState();
  });
  row.querySelector(".remove-library").addEventListener("click", onRemove);
  container.append(row);
}

function renderLibraries(container, libraries, onChange) {
  container.replaceChildren();
  if (libraries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted compact-empty";
    empty.textContent = "No libraries configured.";
    container.append(empty);
    return;
  }

  libraries.forEach((library, index) => {
    addLibraryRow(
      container,
      library,
      (path) => onChange(libraries.map((item, itemIndex) => itemIndex === index ? { path } : item), false),
      () => onChange(libraries.filter((_, itemIndex) => itemIndex !== index), true),
    );
  });
}

function renderTarget(target, index) {
  const card = elements.targetTemplate.content.firstElementChild.cloneNode(true);
  const title = card.querySelector(".target-title");
  const packageInput = card.querySelector(".package-name");
  const childSettings = card.querySelector(".child-settings");

  card.querySelector(".target-index").textContent = String(index + 1).padStart(2, "0");
  title.textContent = target.app_name || "New target";
  card.classList.toggle("disabled-target", !target.enabled);

  const enabledInput = card.querySelector(".target-enabled");
  enabledInput.checked = target.enabled;
  enabledInput.addEventListener("change", () => {
    target.enabled = enabledInput.checked;
    card.classList.toggle("disabled-target", !target.enabled);
    updateDirtyState();
  });

  card.querySelector(".remove-target").addEventListener("click", () => {
    config.targets.splice(index, 1);
    render();
  });

  packageInput.value = target.app_name;
  packageInput.addEventListener("input", () => {
    target.app_name = packageInput.value.trim();
    title.textContent = target.app_name || "New target";
    updateDirtyState();
  });
  card.querySelector(".chooser-button").addEventListener("click", () => openPackageChooser(index));

  const delayInput = card.querySelector(".startup-delay");
  delayInput.value = String(target.start_up_delay_ms);
  delayInput.addEventListener("input", () => {
    target.start_up_delay_ms = Math.max(0, Math.trunc(Number(delayInput.value) || 0));
    updateDirtyState();
  });

  const mainContainer = card.querySelector(".main-libraries");
  const updateMainLibraries = (libraries, shouldRender) => {
    target.injected_libraries = libraries;
    if (shouldRender) render();
    else updateDirtyState();
  };
  renderLibraries(mainContainer, target.injected_libraries, updateMainLibraries);
  card.querySelector(".add-main-library").addEventListener("click", () => {
    target.injected_libraries.push({ path: "" });
    render();
  });

  const childEnabled = card.querySelector(".child-enabled");
  childEnabled.checked = target.child_gating.enabled;
  childSettings.hidden = !target.child_gating.enabled;
  childEnabled.addEventListener("change", () => {
    target.child_gating.enabled = childEnabled.checked;
    childSettings.hidden = !childEnabled.checked;
    updateDirtyState();
  });

  const childMode = card.querySelector(".child-mode");
  childMode.value = target.child_gating.mode;
  childMode.addEventListener("change", () => {
    target.child_gating.mode = childMode.value;
    updateDirtyState();
  });

  const childContainer = card.querySelector(".child-libraries");
  const updateChildLibraries = (libraries, shouldRender) => {
    target.child_gating.injected_libraries = libraries;
    if (shouldRender) render();
    else updateDirtyState();
  };
  renderLibraries(childContainer, target.child_gating.injected_libraries, updateChildLibraries);
  card.querySelector(".add-child-library").addEventListener("click", () => {
    target.child_gating.injected_libraries.push({ path: "" });
    render();
  });

  return card;
}

function render() {
  elements.targets.replaceChildren(...config.targets.map(renderTarget));
  elements.emptyState.hidden = config.targets.length !== 0;
  updateDirtyState();
}

function addTarget() {
  hideNotice();
  config.targets.push(newTarget());
  render();
  requestAnimationFrame(() => {
    const input = elements.targets.lastElementChild?.querySelector(".package-name");
    input?.focus();
    elements.targets.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function validateConfig() {
  const packageNames = new Set();
  for (const [index, target] of config.targets.entries()) {
    if (!target.app_name) return `Target ${index + 1} needs a package name.`;
    if (packageNames.has(target.app_name)) return `Package ${target.app_name} is configured more than once.`;
    packageNames.add(target.app_name);
    if (!Number.isSafeInteger(target.start_up_delay_ms) || target.start_up_delay_ms < 0) {
      return `Target ${target.app_name} has an invalid startup delay.`;
    }
    const allLibraries = [...target.injected_libraries, ...target.child_gating.injected_libraries];
    if (allLibraries.some((library) => !library.path.startsWith("/"))) {
      return `Every library path for ${target.app_name} must be an absolute path.`;
    }
  }
  return null;
}

function saveConfig() {
  const validationError = validateConfig();
  if (validationError) {
    showNotice("error", validationError);
    return;
  }

  const fileBridge = findFileBridge();
  if (!fileBridge) {
    showNotice("error", "WebUI X file access is unavailable.");
    return;
  }

  try {
    const serialized = `${JSON.stringify(config, null, 2)}\n`;
    fileBridge.write(CONFIG_PATH, serialized);
    const written = fileBridge.read(CONFIG_PATH);
    if (written == null || JSON.stringify(JSON.parse(written)) !== JSON.stringify(config)) {
      throw new Error("the saved file could not be verified");
    }
    initialSnapshot = JSON.stringify(config);
    updateDirtyState();
    showNotice("success", "Configuration saved. Force-stop and reopen target apps to apply it.");
  } catch (error) {
    showNotice("error", `Unable to save configuration: ${error.message}`);
  }
}

function getInstalledPackages() {
  if (!window.$packageManager) return [];
  const packageNames = JSON.parse(window.$packageManager.getInstalledPackages());
  return packageNames.map((packageName) => {
    try {
      const info = window.$packageManager.getApplicationInfo(packageName);
      return { packageName, name: info.getName() || info.getLabel() || packageName };
    } catch {
      return { packageName, name: packageName };
    }
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function renderPackageChoices() {
  const query = elements.packageSearch.value.toLocaleLowerCase().replace(/[\s-]/g, "");
  const currentPackage = packageTargetIndex == null ? "" : config.targets[packageTargetIndex]?.app_name;
  const configuredPackages = new Set(config.targets.map((target) => target.app_name).filter(Boolean));
  const matches = packageChoices.filter(({ name, packageName }) => {
    if (!query) return true;
    return `${name}${packageName}`.toLocaleLowerCase().replace(/[\s-]/g, "").includes(query);
  });

  const fragment = document.createDocumentFragment();
  for (const choice of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "package-item";
    button.disabled = configuredPackages.has(choice.packageName) && choice.packageName !== currentPackage;

    const badge = document.createElement("span");
    badge.className = "package-badge";
    badge.textContent = (choice.name || choice.packageName).slice(0, 1).toUpperCase();
    const text = document.createElement("span");
    text.className = "package-text";
    const name = document.createElement("strong");
    name.textContent = choice.name;
    const packageName = document.createElement("code");
    packageName.textContent = choice.packageName;
    text.append(name, packageName);
    button.append(badge, text);
    button.addEventListener("click", () => {
      const target = config.targets[packageTargetIndex];
      if (target) target.app_name = choice.packageName;
      elements.packageDialog.close();
      render();
    });
    fragment.append(button);
  }

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "dialog-empty";
    empty.textContent = packageChoices.length === 0
      ? "Installed packages are unavailable. Enter the package name manually."
      : "No packages match your search.";
    fragment.append(empty);
  }
  elements.packageList.replaceChildren(fragment);
}

function openPackageChooser(index) {
  packageTargetIndex = index;
  elements.packageSearch.value = "";
  try {
    if (packageChoices.length === 0) packageChoices = getInstalledPackages();
  } catch (error) {
    console.error("Unable to list installed packages", error);
    packageChoices = [];
  }
  renderPackageChoices();
  elements.packageDialog.showModal();
  requestAnimationFrame(() => elements.packageSearch.focus());
}

elements.addTarget.addEventListener("click", addTarget);
elements.emptyAddTarget.addEventListener("click", addTarget);
elements.saveConfig.addEventListener("click", saveConfig);
elements.packageSearch.addEventListener("input", renderPackageChoices);
elements.packageDialog.addEventListener("click", (event) => {
  if (event.target === elements.packageDialog) elements.packageDialog.close();
});

loadConfig();
render();
