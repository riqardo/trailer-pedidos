export const ADDONS = [
  {
    code: "extra_salsicha",
    name: "Extra salsicha",
    price: 4.0,
    icon: "🌭",
    sortOrder: 1,
  },
  {
    code: "extra_cheddar",
    name: "Extra cheddar",
    price: 3.5,
    icon: "🧀",
    sortOrder: 2,
  },
  {
    code: "extra_bacon",
    name: "Extra bacon",
    price: 4.5,
    icon: "🥓",
    sortOrder: 3,
  },
  {
    code: "ovo_frito",
    name: "Ovo frito",
    price: 2.5,
    icon: "🍳",
    sortOrder: 4,
  },
];

const ADDONS_BY_CODE = new Map(ADDONS.map((addon) => [addon.code, addon]));

export function getAddon(code) {
  return ADDONS_BY_CODE.get(code) ?? null;
}

export function listAddons() {
  return ADDONS.map((addon) => ({
    code: addon.code,
    name: addon.name,
    price: addon.price,
    icon: addon.icon,
    sortOrder: addon.sortOrder,
  }));
}
