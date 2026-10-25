/* Line-art map icons (house, castle, dragon, forest, alert) */

const ICON_BASE = "/static/img/icons";

export const LOCATION_ICONS = ["house", "castle", "dragon", "forest", "alert"];

export const ICON_META = {
  house: { label: "House", src: `${ICON_BASE}/house.svg` },
  castle: { label: "Castle", src: `${ICON_BASE}/castle.svg` },
  dragon: { label: "Dragon", src: `${ICON_BASE}/dragon.svg` },
  forest: { label: "Forest", src: `${ICON_BASE}/forest.svg` },
  alert: { label: "Alert", src: `${ICON_BASE}/alert.svg` },
};

export function iconMeta(icon) {
  return ICON_META[icon] || ICON_META.alert;
}

export function iconImgHtml(iconKey, className = "icon-img") {
  const meta = iconMeta(iconKey);
  return `<img class="${className}" src="${meta.src}" alt="${meta.label}" draggable="false" />`;
}
