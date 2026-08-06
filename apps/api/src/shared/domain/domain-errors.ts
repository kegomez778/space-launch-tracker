/**
 * Vocabulario de errores del dominio.
 *
 * Ninguna capa interna conoce códigos HTTP: la traducción ocurre en un único
 * filtro de excepciones, de modo que el mismo error sirve igual a un controlador
 * HTTP que a una tarea programada.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class LaunchNotFoundError extends DomainError {
  readonly code = 'LAUNCH_NOT_FOUND';

  constructor(launchId: string) {
    super(`No hay ninguna misión con identificador "${launchId}" en el catálogo`);
  }
}

export class CountryNotFoundError extends DomainError {
  readonly code = 'COUNTRY_NOT_FOUND';

  constructor(code: string) {
    super(`No hay ningún país con código "${code}" en el catálogo`);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    // Deliberadamente ambiguo: decir cuál de los dos falla permite enumerar cuentas.
    super('Email o contraseña incorrectos');
  }
}

export class EmailAlreadyRegisteredError extends DomainError {
  readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor() {
    super('Ya existe una cuenta con ese email');
  }
}
