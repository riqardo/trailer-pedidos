export class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code, message, details = null) {
  return new HttpError(400, code, message, details);
}

export function unauthorized(message = "Autenticacao necessaria.") {
  return new HttpError(401, "UNAUTHORIZED", message);
}

export function notFound(message = "Recurso nao encontrado.") {
  return new HttpError(404, "NOT_FOUND", message);
}

export function conflict(code, message, details = null) {
  return new HttpError(409, code, message, details);
}

export function validationError(message, details = null) {
  return new HttpError(422, "VALIDATION_ERROR", message, details);
}
