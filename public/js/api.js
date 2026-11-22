const TOKEN_KEY = "trailer.token";

let token = localStorage.getItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(message, code, status, details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function setToken(value) {
  token = value;
  if (value) {
    localStorage.setItem(TOKEN_KEY, value);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return token;
}

export function clearToken() {
  setToken(null);
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const text = query.toString();
  return text ? `?${text}` : "";
}

async function request(path, { method = "GET", body, query } = {}) {
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`/api${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Não foi possível conectar à API. Verifique se o servidor está no ar.",
      "NETWORK_ERROR",
      0,
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message ?? "Não foi possível concluir a operação.",
      data?.error?.code ?? "REQUEST_ERROR",
      response.status,
      data?.error?.details ?? null,
    );
  }

  return data;
}

export const api = {
  login(credentials) {
    return request("/auth/login", { method: "POST", body: credentials });
  },

  me() {
    return request("/auth/me");
  },

  products(query) {
    return request("/products", { query });
  },

  addons() {
    return request("/addons");
  },

  orders(query) {
    return request("/orders", { query });
  },

  order(id) {
    return request(`/orders/${id}`);
  },

  createOrder(payload) {
    return request("/orders", { method: "POST", body: payload });
  },

  updateOrder(id, payload) {
    return request(`/orders/${id}`, { method: "PATCH", body: payload });
  },

  addItem(orderId, payload) {
    return request(`/orders/${orderId}/items`, {
      method: "POST",
      body: payload,
    });
  },

  updateItem(orderId, itemId, payload) {
    return request(`/orders/${orderId}/items/${itemId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  removeItem(orderId, itemId) {
    return request(`/orders/${orderId}/items/${itemId}`, {
      method: "DELETE",
    });
  },

  finalizeOrder(id, paymentMethod) {
    return request(`/orders/${id}/finalize`, {
      method: "POST",
      body: { paymentMethod },
    });
  },
};
