import { HttpError } from "../utils/http-error.js";

export function apiNotFound(req, _res, next) {
  next(
    new HttpError(
      404,
      "ROUTE_NOT_FOUND",
      `Rota ${req.method} ${req.originalUrl} não encontrada.`,
    ),
  );
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  if (error?.name === "CastError") {
    return res.status(400).json({
      error: {
        code: "INVALID_ID",
        message: "Identificador inválido.",
      },
    });
  }

  if (error?.name === "ValidationError") {
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Os dados enviados são inválidos.",
        details: Object.values(error.errors).map((item) => item.message),
      },
    });
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "O corpo da requisição não contém um JSON válido.",
      },
    });
  }

  console.error("[erro]", error);
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Erro interno do servidor.",
    },
  });
}
