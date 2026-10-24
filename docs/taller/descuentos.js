export function calcularDescuento(precio, cupon) {
  if (cupon === "ADA10") return precio * 0.9;
  if (cupon === "ADA50") return precio * 0.5;
  return precio;
}
