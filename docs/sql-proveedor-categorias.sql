-- Categorías que maneja un proveedor (Frenos, Motor, Eléctrico, etc.).
-- Sirve para sugerirlo de primero cuando se cotiza un repuesto de esa
-- categoría, aunque todavía no tenga historial de compras.
-- Si no se corre, todo funciona igual (el campo se ignora) y el ranking se
-- basa solo en el historial.

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS categorias text[] DEFAULT '{}';
