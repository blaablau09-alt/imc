export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const calcIMC = (peso, alturaCm) => peso / Math.pow(alturaCm / 100, 2);
// Classificação da OMS para adultos
export function classificar(imc) {
  if (imc < 18.5) return { txt: "Abaixo do peso", cor: "t-az" };
  if (imc < 25) return { txt: "Peso normal", cor: "t-ok" };
  if (imc < 30) return { txt: "Sobrepeso", cor: "t-am" };
  if (imc < 35) return { txt: "Obesidade grau I", cor: "t-er" };
  if (imc < 40) return { txt: "Obesidade grau II", cor: "t-er" };
  return { txt: "Obesidade grau III", cor: "t-er" };
}
export const fmtData = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
export const hoje = () => new Date().toISOString().slice(0, 10);
export const tag = (imc) => { const c = classificar(imc); return `<span class="tag ${c.cor}">${c.txt}</span>`; };
