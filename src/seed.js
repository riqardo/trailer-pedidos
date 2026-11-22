import bcrypt from "bcryptjs";
import { User } from "./models/User.js";
import { Product } from "./models/Product.js";
import { Order } from "./models/Order.js";
import { Counter } from "./models/Counter.js";
import { getAddon } from "./data/addons.js";
import { calculateTotals, fromCents, toCents } from "./utils/money.js";

const PRODUCTS = [
  {
    name: "Hot Dog Clássico",
    description: "Pão macio, salsicha, molho especial da casa e batata palha.",
    category: "lanche",
    price: 14.9,
    icon: "🌭",
    available: true,
  },
  {
    name: "Hot Dog Completo",
    description:
      "Salsicha, queijo, presunto, milho, ervilha, vinagrete e batata palha.",
    category: "lanche",
    price: 19.9,
    icon: "🌭",
    available: true,
  },
  {
    name: "Hot Dog Cheddar Bacon",
    description: "Cheddar cremoso, bacon crocante e cebola crispy.",
    category: "lanche",
    price: 24.9,
    icon: "🥓",
    available: true,
  },
  {
    name: "Hot Dog Mexicano",
    description: "Chili apimentado, cheddar, jalapeño e Doritos.",
    category: "lanche",
    price: 26.9,
    icon: "🌶️",
    available: true,
  },
  {
    name: "Hot Dog Vegano",
    description: "Salsicha vegana, cebola caramelizada e rúcula fresca.",
    category: "lanche",
    price: 22.9,
    icon: "🌱",
    available: true,
  },
  {
    name: "Batata Frita Especial",
    description: "Porção individual com cheddar e bacon.",
    category: "lanche",
    price: 16.9,
    icon: "🍟",
    available: true,
  },
  {
    name: "Combo Casal",
    description: "2 hot dogs completos + 2 refrigerantes lata.",
    category: "lanche",
    price: 44.9,
    icon: "🧺",
    available: true,
  },
  {
    name: "Refrigerante Lata 350ml",
    description: "Coca-Cola, Guaraná ou Fanta, geladinho.",
    category: "bebida",
    price: 6.0,
    icon: "🥤",
    available: true,
  },
  {
    name: "Suco de Laranja 300ml",
    description: "Suco natural feito na hora.",
    category: "bebida",
    price: 8.0,
    icon: "🧃",
    available: true,
  },
  {
    name: "Água Mineral 500ml",
    description: "Água mineral sem gás. Estoque esgotado.",
    category: "bebida",
    price: 4.0,
    icon: "💧",
    available: false,
  },
];

const USERS = [
  { name: "Ana Souza", username: "ana", password: "ana123", role: "atendente" },
  {
    name: "Bruno Lima",
    username: "bruno",
    password: "bruno123",
    role: "atendente",
  },
  {
    name: "Carla Mendes",
    username: "carla",
    password: "carla123",
    role: "gerente",
  },
];

function attendant(user) {
  return { userId: user._id, name: user.name, username: user.username };
}

function makeItem(product, quantity, { notes = null, addons = [] } = {}) {
  const addonSnapshots = addons.map((selection) => {
    const addon = getAddon(selection.code);
    if (!addon) {
      throw new Error(`Adicional de seed desconhecido: ${selection.code}`);
    }
    return {
      code: addon.code,
      name: addon.name,
      unitPrice: addon.price,
      quantity: selection.quantity,
      lineTotal: fromCents(toCents(addon.price) * selection.quantity),
    };
  });

  const addonsCents = addonSnapshots.reduce(
    (sum, addon) => sum + toCents(addon.unitPrice) * addon.quantity,
    0,
  );

  return {
    productId: product._id,
    name: product.name,
    category: product.category,
    unitPrice: product.price,
    quantity,
    notes,
    addons: addonSnapshots,
    lineTotal: fromCents((toCents(product.price) + addonsCents) * quantity),
  };
}

async function seedOrders(users, products) {
  const ana = users.find((user) => user.username === "ana");
  const bruno = users.find((user) => user.username === "bruno");
  const productsByName = new Map(products.map((product) => [product.name, product]));

  const now = Date.now();

  const openItems = [
    makeItem(productsByName.get("Hot Dog Completo"), 2, {
      notes: "Sem cebola",
    }),
    makeItem(productsByName.get("Refrigerante Lata 350ml"), 1),
  ];
  const openTotals = calculateTotals(openItems, null);

  const paidItems = [
    makeItem(productsByName.get("Hot Dog Cheddar Bacon"), 1),
    makeItem(productsByName.get("Batata Frita Especial"), 1),
    makeItem(productsByName.get("Suco de Laranja 300ml"), 1),
  ];
  const paidTotals = calculateTotals(paidItems, "dinheiro");

  const openOrder = new Order({
    number: 1,
    customerName: "Seu Joaquim",
    location: { type: "mesa", label: "4" },
    items: openItems,
    subtotal: openTotals.subtotal,
    discount: 0,
    total: openTotals.total,
    status: "open",
    createdBy: attendant(ana),
    updatedBy: attendant(ana),
    history: [
      {
        action: "created",
        attendant: attendant(ana),
        at: new Date(now - 22 * 60 * 1000),
        details: { itemCount: 3, total: openTotals.total },
      },
    ],
  });

  const paidOrder = new Order({
    number: 2,
    customerName: "Marina Alves",
    location: { type: "placa", label: "ABC-1D23", vehicle: "Fiat Uno prata" },
    items: paidItems,
    subtotal: paidTotals.subtotal,
    discount: paidTotals.discount,
    total: paidTotals.total,
    status: "finalized",
    createdBy: attendant(bruno),
    updatedBy: attendant(bruno),
    finalizedBy: attendant(bruno),
    payment: {
      method: "dinheiro",
      subtotal: paidTotals.subtotal,
      discount: paidTotals.discount,
      total: paidTotals.total,
      paidAt: new Date(now - 45 * 60 * 1000),
      processedBy: attendant(bruno),
      simulated: true,
    },
    history: [
      {
        action: "created",
        attendant: attendant(bruno),
        at: new Date(now - 52 * 60 * 1000),
        details: { itemCount: 3, total: paidTotals.subtotal },
      },
      {
        action: "finalized",
        attendant: attendant(bruno),
        at: new Date(now - 45 * 60 * 1000),
        details: {
          paymentMethod: "dinheiro",
          subtotal: paidTotals.subtotal,
          discount: paidTotals.discount,
          total: paidTotals.total,
        },
      },
    ],
  });

  await Order.insertMany([openOrder, paidOrder]);
}

export async function seedDatabase() {
  let users = await User.find();

  if (users.length === 0) {
    const usersWithHash = await Promise.all(
      USERS.map(async (user) => ({
        name: user.name,
        username: user.username,
        passwordHash: await bcrypt.hash(user.password, 10),
        role: user.role,
        active: true,
      })),
    );
    users = await User.insertMany(usersWithHash);
    console.log("[seed] 3 usuários criados.");
  }

  let products = await Product.find();

  if (products.length === 0) {
    products = await Product.insertMany(
      PRODUCTS.map((product, index) => ({ ...product, sortOrder: index + 1 })),
    );
    console.log("[seed] 10 produtos criados (1 indisponível).");
  }

  const orderCount = await Order.countDocuments();
  if (orderCount === 0) {
    await seedOrders(users, products);
    console.log("[seed] 2 pedidos de demonstração criados.");
  }

  const lastOrder = await Order.findOne().sort({ number: -1 }).select("number");
  await Counter.findByIdAndUpdate(
    "order",
    { $max: { seq: lastOrder?.number ?? 0 } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}
