// Simulación local de un pago con tarjeta en un punto de venta (POS). NO hay conexión con bancos:
// todo ocurre en el navegador. La clave se usa solo para la simulación: no se envía ni se guarda.
//
// Claves de prueba (comportamiento determinista):
//   0000 -> rechazada por el banco emisor
//   1111 -> fondos insuficientes
//   2222 -> clave incorrecta
//   cualquier otra clave de 4 dígitos -> aprobada

const CLAVES_RECHAZADAS = {
  "0000": "Operación rechazada por el banco emisor.",
  "1111": "Fondos insuficientes en la cuenta.",
  "2222": "Clave incorrecta.",
};

export const soloDigitos = (valor) => String(valor || "").replace(/\D/g, "");

// Cédula venezolana: 6 a 8 dígitos (el prefijo V/E se elige aparte).
export function validateCedula(valor) {
  const d = soloDigitos(valor);
  if (d.length < 6 || d.length > 8) return "La cédula debe tener entre 6 y 8 dígitos.";
  return undefined;
}

export const TIPOS_CUENTA = ["Corriente", "Ahorro"];

export function validatePos({ cedula, cuenta, clave }) {
  const errores = {};
  const errCedula = validateCedula(cedula);
  if (errCedula) errores.cedula = errCedula;
  if (!TIPOS_CUENTA.includes(cuenta)) errores.cuenta = "Selecciona el tipo de cuenta.";
  if (!/^\d{4}$/.test(clave || "")) errores.clave = "La clave debe tener exactamente 4 dígitos.";
  return errores;
}

// Simula la comunicación con el POS (1–2 s). Resuelve { aprobado, codigo?, motivo? }.
export function simulatePosPayment({ clave }, monto) {
  const espera = 1000 + Math.random() * 1000;
  return new Promise((resolve) => {
    setTimeout(() => {
      if (!(monto > 0)) {
        resolve({ aprobado: false, motivo: "El monto a cobrar no es válido." });
      } else if (CLAVES_RECHAZADAS[clave]) {
        resolve({ aprobado: false, motivo: CLAVES_RECHAZADAS[clave] });
      } else {
        resolve({ aprobado: true, codigo: "AUT-" + Math.random().toString(36).slice(2, 8).toUpperCase() });
      }
    }, espera);
  });
}
