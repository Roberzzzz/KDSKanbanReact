// Ventana de pago: resumen, método de pago y el flujo propio de cada método
// (efectivo directo, pago móvil con referencia y tarjeta simulando un punto de venta).
// Todos los pagos son simulados: no hay conexión con ningún banco.

import { useState, useEffect, useRef } from "react";
import { formatPrice, paymentMethods } from "../data/products";
import { soloDigitos, validatePos, simulatePosPayment, TIPOS_CUENTA } from "../data/cardPayment";
import {
  BANCOS,
  REFERENCIA_MAX,
  validateMobile,
  simulateMobilePayment,
} from "../data/mobilePayment";
import "../styles/PaymentModal.css";

const MOVIL_INICIAL = { cedulaTipo: "V", cedula: "", telefono: "", banco: "", referencia: "" };
const POS_INICIAL = { cedulaTipo: "V", cedula: "", cuenta: "", clave: "" };

function PaymentModal({
  cartItems,
  total,
  paymentMethod,
  onSelectMethod,
  onConfirm,
  onClose,
  processing = false, // true mientras se registra el pedido en el servidor
}) {
  // Pasos: pago móvil -> "form" | "validando" | "registrado"
  //        tarjeta    -> "insertar" | "datos" | "procesando" | "resultado"
  const [step, setStep] = useState("form");
  const [movil, setMovil] = useState(MOVIL_INICIAL);
  const [pos, setPos] = useState(POS_INICIAL);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null); // resultado del POS: { aprobado, codigo, motivo }
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isMovil = paymentMethod === "pago_movil";
  const isCard = paymentMethod === "tarjeta";
  const busy = processing || step === "validando" || step === "procesando";

  // Cambiar de método descarta por completo los datos del anterior
  function selectMethod(id) {
    if (busy || id === paymentMethod) return;
    setMovil(MOVIL_INICIAL);
    setPos(POS_INICIAL);
    setErrors({});
    setResult(null);
    setStep(id === "tarjeta" ? "insertar" : "form");
    onSelectMethod(id);
  }

  const setMovilField = (field, value) => {
    setMovil((m) => ({ ...m, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const setPosField = (field, value) => {
    setPos((p) => ({ ...p, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // ----- Pago móvil -----
  async function submitMovil() {
    const found = validateMobile(movil);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStep("validando");
    await simulateMobilePayment();
    if (mounted.current) setStep("registrado");
  }

  // ----- Tarjeta -----
  async function submitPos() {
    const found = validatePos(pos);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const clave = pos.clave;
    setPos((p) => ({ ...p, clave: "" })); // la clave no se conserva en el estado
    setStep("procesando");
    const res = await simulatePosPayment({ clave }, total);
    if (!mounted.current) return;
    setResult(res);
    setStep("resultado");
  }

  function retryCard() {
    setResult(null);
    setErrors({});
    setPos((p) => ({ ...p, clave: "" }));
    setStep("datos");
  }

  function chooseOtherMethod() {
    setMovil(MOVIL_INICIAL);
    setPos(POS_INICIAL);
    setErrors({});
    setResult(null);
    setStep("form");
    onSelectMethod("");
  }

  function finishMovil() {
    onConfirm({
      tipo: "pago_movil",
      banco: movil.banco,
      referencia: movil.referencia,
    });
  }

  function finishCard() {
    if (!result?.aprobado) return; // un pago rechazado nunca genera pedido
    onConfirm({ tipo: "tarjeta", codigo: result.codigo, cuenta: pos.cuenta });
  }

  // ----- Botón principal según método y paso -----
  let primary = null;
  if (paymentMethod === "efectivo") {
    primary = { label: "Confirmar pedido", onClick: () => onConfirm({ tipo: "efectivo" }) };
  } else if (isMovil) {
    if (step === "registrado") primary = { label: "Confirmar pedido", onClick: finishMovil };
    else primary = { label: step === "validando" ? "Validando…" : "Registrar pago", onClick: submitMovil, disabled: step === "validando" };
  } else if (isCard) {
    if (step === "insertar") primary = { label: "Ya inserté mi tarjeta", onClick: () => setStep("datos") };
    else if (step === "datos") primary = { label: `Pagar ${formatPrice(total)}`, onClick: submitPos };
    else if (step === "procesando") primary = { label: "Procesando…", disabled: true };
    else if (step === "resultado" && result?.aprobado) primary = { label: "Continuar con el pedido", onClick: finishCard };
    else if (step === "resultado") primary = { label: "Intentar nuevamente", onClick: retryCard };
  }

  const fieldError = (name) =>
    errors[name] && <span className="orders-page__card-error">{errors[name]}</span>;

  return (
    <div className="orders-page__overlay">
      <div
        className="orders-page__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orders-payment-title"
      >
        <h2 id="orders-payment-title" className="orders-page__modal-title">
          Resumen y pago
        </h2>

        <ul className="orders-page__modal-list">
          {cartItems.map((item) => (
            <li key={item.id} className="orders-page__modal-item">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="orders-page__modal-total">
          <span>Total a pagar</span>
          <span>{formatPrice(total)}</span>
        </div>

        <fieldset className="orders-page__payment-methods">
          <legend>Método de pago</legend>
          {paymentMethods.map((method) => {
            const isSelected = paymentMethod === method.id;

            return (
              <label
                key={method.id}
                className={
                  isSelected
                    ? "orders-page__payment-option orders-page__payment-option--active"
                    : "orders-page__payment-option"
                }
              >
                <input
                  type="radio"
                  name="orders-payment-method"
                  value={method.id}
                  checked={isSelected}
                  disabled={busy}
                  onChange={() => selectMethod(method.id)}
                />
                <span>
                  <strong>{method.label}</strong>
                  <small>{method.description}</small>
                </span>
              </label>
            );
          })}
        </fieldset>

        {paymentMethod === "" && (
          <p className="orders-page__modal-hint">Selecciona un método de pago para continuar.</p>
        )}

        {/* ---------- Pago móvil ---------- */}
        {isMovil && step !== "registrado" && (
          <div className="orders-page__card-form">
            <p className="orders-page__modal-note">
              Realiza el pago móvil desde la app de tu banco por {formatPrice(total)} y escribe aquí
              el número de referencia de la transacción para registrar tu pago.
            </p>
            <div className="orders-page__card-row">
              <label className="orders-page__card-field orders-page__card-field--narrow">
                Nac.
                <select
                  value={movil.cedulaTipo}
                  disabled={busy}
                  onChange={(e) => setMovilField("cedulaTipo", e.target.value)}
                >
                  <option value="V">V</option>
                  <option value="E">E</option>
                </select>
              </label>
              <label className="orders-page__card-field">
                Cédula del titular
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12345678"
                  value={movil.cedula}
                  disabled={busy}
                  onChange={(e) => setMovilField("cedula", soloDigitos(e.target.value).slice(0, 8))}
                />
                {fieldError("cedula")}
              </label>
            </div>
            <label className="orders-page__card-field">
              Teléfono asociado a la cuenta
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="04141234567"
                value={movil.telefono}
                disabled={busy}
                onChange={(e) => setMovilField("telefono", soloDigitos(e.target.value).slice(0, 11))}
              />
              {fieldError("telefono")}
            </label>
            <label className="orders-page__card-field">
              Banco emisor
              <select
                value={movil.banco}
                disabled={busy}
                onChange={(e) => setMovilField("banco", e.target.value)}
              >
                <option value="">Selecciona un banco</option>
                {BANCOS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {fieldError("banco")}
            </label>
            <label className="orders-page__card-field">
              Número de referencia
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Solo dígitos"
                value={movil.referencia}
                disabled={busy}
                onChange={(e) => setMovilField("referencia", soloDigitos(e.target.value).slice(0, REFERENCIA_MAX))}
              />
              {fieldError("referencia")}
            </label>
            <p className="orders-page__modal-note">
              Pago simulado: la referencia solo se registra; no se verifica con ningún banco.
            </p>
          </div>
        )}

        {isMovil && step === "validando" && (
          <p className="orders-page__payment-processing" role="status">
            Validando los datos del pago…
          </p>
        )}

        {isMovil && step === "registrado" && (
          <p className="orders-page__payment-ok" role="status">
            ✓ Pago registrado correctamente (simulado). Referencia ****{movil.referencia.slice(-4)}.
            Confirma el pedido para enviarlo a cocina.
          </p>
        )}

        {/* ---------- Tarjeta: punto de venta ---------- */}
        {isCard && (
          <div className="orders-page__card-form">
            <div className="orders-page__pos" aria-hidden="true">
              <div className="orders-page__pos-screen">
                {step === "insertar" && "INSERTE TARJETA"}
                {step === "datos" && "INGRESE DATOS"}
                {step === "procesando" && "COMUNICANDO…"}
                {step === "resultado" && (result?.aprobado ? "APROBADO" : "RECHAZADO")}
              </div>
              <div className="orders-page__pos-keys">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} />
                ))}
              </div>
              <div
                className={
                  step === "insertar"
                    ? "orders-page__pos-slot orders-page__pos-slot--waiting"
                    : "orders-page__pos-slot"
                }
              />
            </div>

            {step === "insertar" && (
              <p className="orders-page__pos-message">Por favor, inserte su tarjeta.</p>
            )}

            {step === "datos" && (
              <>
                <div className="orders-page__card-row">
                  <label className="orders-page__card-field orders-page__card-field--narrow">
                    Nac.
                    <select
                      value={pos.cedulaTipo}
                      onChange={(e) => setPosField("cedulaTipo", e.target.value)}
                    >
                      <option value="V">V</option>
                      <option value="E">E</option>
                    </select>
                  </label>
                  <label className="orders-page__card-field">
                    Cédula del titular
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="12345678"
                      value={pos.cedula}
                      onChange={(e) => setPosField("cedula", soloDigitos(e.target.value).slice(0, 8))}
                    />
                    {fieldError("cedula")}
                  </label>
                </div>
                <label className="orders-page__card-field">
                  Tipo de cuenta
                  <select value={pos.cuenta} onChange={(e) => setPosField("cuenta", e.target.value)}>
                    <option value="">Selecciona</option>
                    {TIPOS_CUENTA.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {fieldError("cuenta")}
                </label>
                <label className="orders-page__card-field">
                  Clave de la tarjeta (4 dígitos)
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="••••"
                    value={pos.clave}
                    onChange={(e) => setPosField("clave", soloDigitos(e.target.value).slice(0, 4))}
                  />
                  {fieldError("clave")}
                </label>
                <p className="orders-page__modal-note">
                  Pago simulado: no se conecta con ningún banco ni se realiza ningún cargo real, y la
                  clave no se guarda. Para probar: clave 0000 (rechazada), 1111 (fondos insuficientes),
                  2222 (clave incorrecta); cualquier otra clave se aprueba.
                </p>
              </>
            )}

            {step === "procesando" && (
              <p className="orders-page__payment-processing" role="status">
                <span className="orders-page__spinner" aria-hidden="true" /> Comunicando con el punto
                de venta… no cierres esta ventana.
              </p>
            )}

            {step === "resultado" && result?.aprobado && (
              <p className="orders-page__payment-ok" role="status">
                ✓ Operación aprobada (simulada). Autorización <strong>{result.codigo}</strong>.
              </p>
            )}

            {step === "resultado" && result && !result.aprobado && (
              <p className="orders-page__payment-failed" role="alert">
                ✕ Operación rechazada. {result.motivo} No se realizó ningún cargo; puedes intentarlo de
                nuevo o elegir otro método de pago.
              </p>
            )}
          </div>
        )}

        {processing && (
          <p className="orders-page__payment-processing" role="status">
            Registrando tu pedido…
          </p>
        )}

        <div className="orders-page__modal-actions">
          <button
            type="button"
            className="orders-page__secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Volver al menú
          </button>
          {isCard && step === "resultado" && result && !result.aprobado && (
            <button
              type="button"
              className="orders-page__secondary-button"
              disabled={busy}
              onClick={chooseOtherMethod}
            >
              Elegir otro método
            </button>
          )}
          <button
            type="button"
            className="orders-page__primary-button"
            disabled={!primary || primary.disabled || busy || cartItems.length === 0}
            onClick={primary?.onClick}
          >
            {primary ? primary.label : "Confirmar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
