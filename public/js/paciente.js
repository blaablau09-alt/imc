import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { esc, fmtData, tag } from "./util.js";

const area = document.getElementById("area");
document.getElementById("sair").onclick = () => signOut(auth).then(() => (location.href = "index.html"));

onAuthStateChanged(auth, async (u) => {
  if (!u) return (location.href = "index.html");
  try {
    const s = await getDocs(query(collection(db, "pacientes"), where("email", "==", u.email.toLowerCase())));
    if (s.empty) { area.innerHTML = `<div class="card vazio">Seu médico ainda não liberou seu cadastro.</div>`; return; }
    const pd = s.docs[0], p = pd.data();
    document.getElementById("quem").textContent = `Olá, ${p.nome.split(" ")[0]}`;
    const base = collection(db, "pacientes", pd.id);
    const [a, m] = await Promise.all([getDocs(query(collection(base, "avaliacoes"), orderBy("data", "desc"))), getDocs(collection(base, "metas"))]);
    const avs = a.docs.map((d) => d.data()), metas = m.docs.map((d) => d.data());
    const ult = avs[0];
    area.innerHTML = `
    <div class="card"><h2>Minha situação atual</h2>${ult
      ? `<p><span class="imc">${ult.imc.toFixed(1)}</span> ${tag(ult.imc)}</p><p class="mt">Peso: ${ult.peso} kg · Altura: ${ult.altura} cm · Avaliado em ${fmtData(ult.data)}</p>${ult.obs ? `<p>${esc(ult.obs)}</p>` : ""}`
      : `<div class="vazio">Você ainda não teve uma avaliação registrada.</div>`}</div>
    <div class="card"><h2>Minhas metas</h2>${metas.map((x) => {
      const ac = (x.acompanhamentos || []).slice(-3).reverse().map((y) => `<li>${fmtData(y.data)}: ${esc(y.nota)}</li>`).join("");
      let prog = "";
      if (x.alvo && avs.length) {
        const ini = avs[avs.length - 1].peso, now = ult.peso;
        const pct = ini === x.alvo ? 100 : Math.max(0, Math.min(100, ((ini - now) / (ini - x.alvo)) * 100));
        prog = `<div class="barra"><i style="width:${pct}%"></i></div><span class="mt">Atual ${now} kg · alvo ${x.alvo} kg (${pct.toFixed(0)}%)</span>`;
      }
      return `<div class="meta ${x.status === "Alcançada" ? "feita" : ""}"><strong>${esc(x.titulo)}</strong> <span class="mt">· ${esc(x.status)}${x.prazo ? " · prazo " + fmtData(x.prazo) : ""}</span>${prog}${ac ? `<ul class="mt">${ac}</ul>` : ""}</div>`;
    }).join("") || `<div class="vazio">Seu médico ainda não definiu metas.</div>`}</div>
    <div class="card"><h2>Histórico</h2>${avs.length ? `<table><tr><th>Data</th><th>Peso</th><th>IMC</th><th>Classificação</th></tr>${avs.map((x) => `<tr><td>${fmtData(x.data)}</td><td>${x.peso} kg</td><td>${x.imc.toFixed(1)}</td><td>${tag(x.imc)}</td></tr>`).join("")}</table>` : `<div class="vazio">Sem histórico.</div>`}</div>`;
    const ver = (i) => {
      [...area.children].forEach((c, k) => (c.hidden = k !== i));
      document.querySelectorAll(".nav button").forEach((b) => b.setAttribute("aria-current", +b.dataset.i === i ? "page" : "false"));
    };
    document.querySelectorAll(".nav button").forEach((b) => (b.onclick = () => ver(+b.dataset.i)));
    ver(0);
  } catch (e) { console.error(e); area.innerHTML = `<div class="card vazio">Não foi possível carregar seus dados.</div>`; }
});
