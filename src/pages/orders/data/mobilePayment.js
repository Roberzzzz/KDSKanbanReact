// Pago móvil simulado: solo registra los datos que indica el cliente. No hay conexión ni
// verificación con ningún banco.

import { soloDigitos, validateCedula } from "./cardPayment";

export const BANCOS = [
  "Banco de Venezuela (0102)",
  "Banesco (0134)",
  "Banco Mercantil (0105)",
  "BBVA Provincial (0108)",
  "Banco Nacional de Crédito - BNC (0191)",
  "Banco Occidental de Descuento - BOD (0116)",
  "Banco del Tesoro (0163)",
  "Bancaribe (0114)",
  "Banco Exterior (0115)",
  "Banco Bicentenario (0175)",
  "Banco Activo (0171)",
  "Banplus (0174)",
  "Banco Plaza (0138)",
  "Bancamiga (0172)",
  "Banco Venezolano de Crédito (0104)",
];

export const REFERENCIA_MIN = 6;
export const REFERENCIA_MAX = 12;

// Teléfonos móviles venezolanos: 0412, 0414, 0424, 0416, 0426 + 7 dígitos (11 en total).
const TELEFONO_VE = /^04(12|14|16|24|26)\d{7}$/;

export function validateMobile({ cedula, telefono, banco, referencia }) {
  const errores = {};
  const errCedula = validateCedula(cedula);
  if (errCedula) errores.cedula = errCedula;
  if (!TELEFONO_VE.test(telefono || "")) {
    errores.telefono = "Teléfono no válido (ej. 04141234567: 11 dígitos, operadora venezolana).";
  }
  if (!BANCOS.includes(banco)) errores.banco = "Selecciona el banco emisor.";
  const ref = referencia || "";
  if (ref.length < REFERENCIA_MIN || ref.length > REFERENCIA_MAX) {
    errores.referencia = `La referencia debe tener entre ${REFERENCIA_MIN} y ${REFERENCIA_MAX} dígitos.`;
  }
  return errores;
}

// Validación simulada (1–2 s) del formato de los datos; no consulta ningún banco.
export function simulateMobilePayment() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ registrado: true }), 1000 + Math.random() * 1000);
  });
}

export { soloDigitos };
